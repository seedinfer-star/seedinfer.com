"""SeedInfer Provider Agent — FastAPI Priority Proxy
CUDA optimized for Gemma 4 26B A4B NVFP4, proxy to vLLM nightly with priority scheduling,
GPU telemetry via pynvml, heartbeat every 30s to gateway.
Compatible with lib/types.ts Provider & OpenRouter integration schema.
Expose: 3001 (agent) — vLLM on 8000.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import signal
import socket
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# --- Config via env ---
AGENT_PORT = int(os.getenv("AGENT_PORT", "3001"))
VLLM_URL = os.getenv("VLLM_URL", f"http://127.0.0.1:{os.getenv('VLLM_PORT','8000')}").rstrip("/")
GATEWAY_URL = os.getenv("SEEDINFER_GATEWAY_URL", "https://seedinfer.com").rstrip("/")
PROVIDER_API_KEY = os.getenv("PROVIDER_API_KEY") or os.getenv("SEEDINFER_API_KEY") or ""
MODEL = os.getenv("MODEL", "google/gemma-4-26b-a4b-nvfp4")
VLLM_MODEL = os.getenv("VLLM_MODEL", "nvidia/Gemma-4-26B-A4B-NVFP4")
PROVIDER_ID_ENV = os.getenv("PROVIDER_ID", "")
PROVIDER_REGION = os.getenv("PROVIDER_REGION", "pl-central")
TAILSCALE_HOSTNAME = os.getenv("TAILSCALE_HOSTNAME", "")
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "30"))
SEEDINFER_PUBLIC_KEY = os.getenv("SEEDINFER_PUBLIC_KEY", "")
SEEDINFER_HW_FINGERPRINT = os.getenv("SEEDINFER_HW_FINGERPRINT", "")
LOG_LEVEL = os.getenv("AGENT_LOG_LEVEL", "info").upper()
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "32"))
AGENT_VERSION = "0.2.0-gemma4-nvfp4-priority"

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s [agent] %(message)s"
)
log = logging.getLogger("seedinfer-provider")

# --- Active Request Management & Priority Locks ---
active_requests = 0
active_requests_lock = asyncio.Lock()

# --- Provider ID ---
def _provider_id() -> str:
    if PROVIDER_ID_ENV:
        return PROVIDER_ID_ENV
    hn = TAILSCALE_HOSTNAME or socket.gethostname()
    try:
        mac = uuid.getnode()
        return f"{hn}-{mac:012x}"[:64]
    except Exception:
        return hn

PROVIDER_ID = _provider_id()

# --- GPU via pynvml ---
try:
    import pynvml  # type: ignore
    _has_nvml = True
    try:
        pynvml.nvmlInit()
    except Exception as e:
        log.warning("pynvml init failed: %s", e)
        _has_nvml = False
except ImportError:
    pynvml = None  # type: ignore
    _has_nvml = False
    log.warning("pynvml not installed — GPU metrics degraded")

try:
    import psutil  # type: ignore
    _has_psutil = True
except ImportError:
    psutil = None  # type: ignore
    _has_psutil = False

# Global telemetry stats
_requests_served = 0
_tokens_generated = 0
_start_ts = time.time()

def gpu_info() -> dict[str, Any]:
    if not _has_nvml:
        return {"count": 0, "devices": [], "total_memory_gb": 0, "gpu_cores": 0}
    try:
        n = pynvml.nvmlDeviceGetCount()
        devs = []
        total_mem = 0
        for i in range(n):
            h = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(h)
            if isinstance(name, bytes):
                name = name.decode()
            mem = pynvml.nvmlDeviceGetMemoryInfo(h)
            total_mem += mem.total
            try:
                util = pynvml.nvmlDeviceGetUtilizationRates(h)
                gpu_util = util.gpu
                mem_util = util.memory
            except Exception:
                gpu_util = mem_util = 0
            try:
                temp = pynvml.nvmlDeviceGetTemperature(h, pynvml.NVML_TEMPERATURE_GPU)
            except Exception:
                temp = 0
            devs.append({
                "index": i, "name": name,
                "memory_total_mb": int(mem.total // 1024 // 1024),
                "memory_used_mb": int(mem.used // 1024 // 1024),
                "memory_free_mb": int(mem.free // 1024 // 1024),
                "util_gpu": int(gpu_util), "util_memory": int(mem_util),
                "temperature_c": int(temp),
            })
        gpu_cores = 21760 if any("5090" in d["name"] for d in devs) else n * 2048
        return {"count": n, "devices": devs, "total_memory_gb": round(total_mem / 1024**3, 1), "gpu_cores": gpu_cores}
    except Exception as e:
        log.warning("gpu_info error: %s", e)
        return {"count": 0, "devices": [], "total_memory_gb": 0, "gpu_cores": 0, "error": str(e)}

def host_info() -> dict[str, Any]:
    cpu_total = os.cpu_count() or 0
    mem_gb = 0
    if _has_psutil:
        try:
            mem_gb = round(psutil.virtual_memory().total / 1024**3, 1)
        except Exception:
            pass
    return {
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "cpu_total": cpu_total,
        "memory_gb": mem_gb,
        "tailscale_hostname": TAILSCALE_HOSTNAME or "",
    }

def _tailscale_ip() -> str:
    env_ip = os.getenv("TAILSCALE_IP", "")
    if env_ip:
        return env_ip.strip()
    try:
        import subprocess
        out = subprocess.check_output(["tailscale", "ip", "-4"], timeout=2, stderr=subprocess.DEVNULL)
        ip = out.decode().strip().splitlines()[0].strip() if out else ""
        if ip and ip.startswith("100."):
            return ip
    except Exception:
        pass
    hn = TAILSCALE_HOSTNAME or ""
    if hn:
        for candidate in [f"{hn}.seedinfer.ts.net", hn]:
            try:
                ip = socket.gethostbyname(candidate)
                if ip and ip.startswith("100."):
                    return ip
            except Exception:
                pass
    return ""

def _agent_port_external() -> int:
    p = os.getenv("HOST_AGENT_PORT") or os.getenv("EXTERNAL_AGENT_PORT") or os.getenv("HOST_PORT")
    if p:
        try:
            return int(p)
        except ValueError:
            pass
    return 47901

def _agent_url() -> str:
    ext_port = _agent_port_external()
    ip = _tailscale_ip()
    if ip:
        return f"http://{ip}:{ext_port}"
    hn = TAILSCALE_HOSTNAME or ""
    if hn:
        return f"http://{hn}.seedinfer.ts.net:{ext_port}"
    try:
        return f"http://{socket.gethostname()}:{ext_port}"
    except Exception:
        return f"http://127.0.0.1:{ext_port}"

async def vllm_health() -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{VLLM_URL}/health")
            if r.status_code == 200:
                return {"status": "ok", "code": r.status_code}
            r2 = await c.get(f"{VLLM_URL}/v1/models")
            return {"status": "ok" if r2.status_code == 200 else "degraded", "code": r2.status_code}
    except Exception as e:
        return {"status": "down", "error": str(e)}

# --- Heartbeat Loop ---
_heartbeat_task: Optional[asyncio.Task] = None
_stop = asyncio.Event()

def build_provider_payload() -> dict[str, Any]:
    gi = gpu_info()
    hi = host_info()
    dev_name = gi["devices"][0]["name"] if gi["devices"] else "unknown-cuda"
    mem_gb = gi["total_memory_gb"] or hi["memory_gb"] or 0
    agent_url = _agent_url()
    tailscale_ip = _tailscale_ip()
    return {
        "id": PROVIDER_ID,
        "chip": dev_name,
        "chip_family": dev_name.split()[0] if dev_name != "unknown-cuda" else "cuda",
        "chip_tier": "high",
        "cpu_cores": {"total": hi["cpu_total"], "performance": hi["cpu_total"], "efficiency": 0},
        "gpu_cores": gi.get("gpu_cores", 0),
        "memory_gb": mem_gb,
        "memory_bandwidth_gbs": 1008,
        "current_model": MODEL,
        "models": [MODEL, "google/gemma-4-26b-a4b-nvfp4", "seedinfer/gemma-4-26b-a4b"],
        "status": "serving",
        "trust_level": "software",
        "attested": False,
        "requests_served": _requests_served,
        "tokens_generated": _tokens_generated,
        "machine_model": hi["platform"],
        "decode_tps": 0,
        "gpu": gi,
        "host": hi,
        "uptime_s": int(time.time() - _start_ts),
        "vllm_model": VLLM_MODEL,
        "region": PROVIDER_REGION,
        "agent_version": AGENT_VERSION,
        "tailscale_ip": tailscale_ip,
        "agent_url": agent_url,
        "public_key": SEEDINFER_PUBLIC_KEY,
        "hw_fingerprint": SEEDINFER_HW_FINGERPRINT,
        "max_concurrency": MAX_CONCURRENT_REQUESTS,
        "tailscale_hostname": TAILSCALE_HOSTNAME or hi.get("tailscale_hostname", ""),
    }

async def heartbeat_loop():
    url = f"{GATEWAY_URL}/api/v1/providers/heartbeat"
    alt_url = f"{GATEWAY_URL}/api/providers/heartbeat"
    headers = {"Content-Type": "application/json"}
    if PROVIDER_API_KEY:
        headers["Authorization"] = f"Bearer {PROVIDER_API_KEY}"
    log.info("heartbeat -> %s every %ds (provider=%s model=%s)", url, HEARTBEAT_INTERVAL, PROVIDER_ID, MODEL)
    async with httpx.AsyncClient(timeout=10) as client:
        while not _stop.is_set():
            payload = build_provider_payload()
            vh = await vllm_health()
            payload["vllm_health"] = vh
            if vh.get("status") != "ok":
                payload["status"] = "draining"
            for hb_url in (url, alt_url):
                try:
                    r = await client.post(hb_url, json=payload, headers=headers)
                    if r.status_code in (200, 201, 202, 204):
                        log.debug("heartbeat ok %s -> %s", hb_url, r.status_code)
                        break
                except Exception as e:
                    log.warning("heartbeat %s failed: %s", hb_url, e)
            try:
                await asyncio.wait_for(_stop.wait(), timeout=HEARTBEAT_INTERVAL)
            except asyncio.TimeoutError:
                continue

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting Gemma 4 Priority Agent provider_id=%s model=%s vllm=%s gateway=%s",
             PROVIDER_ID, MODEL, VLLM_URL, GATEWAY_URL)
    _stop.clear()
    global _heartbeat_task
    _heartbeat_task = asyncio.create_task(heartbeat_loop())
    yield
    log.info("Agent shutdown — stopping heartbeat")
    _stop.set()
    if _heartbeat_task:
        try:
            await asyncio.wait_for(_heartbeat_task, timeout=5)
        except asyncio.TimeoutError:
            _heartbeat_task.cancel()
    if _has_nvml:
        try:
            pynvml.nvmlShutdown()
        except Exception:
            pass

app = FastAPI(title="SeedInfer Provider Agent (Gemma 4 Priority Proxy)", version=AGENT_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# --- Routes ---

@app.get("/health")
async def health():
    gi = gpu_info()
    vh = await vllm_health()
    return {
        "status": "ok",
        "provider_id": PROVIDER_ID,
        "model": MODEL,
        "vllm_model": VLLM_MODEL,
        "vllm_url": VLLM_URL,
        "vllm_health": vh,
        "gpu": gi,
        "active_requests": active_requests,
        "max_concurrent_requests": MAX_CONCURRENT_REQUESTS,
        "requests_served": _requests_served,
        "uptime_s": int(time.time() - _start_ts),
    }

@app.get("/v1/models")
@app.get("/api/v1/models")
async def list_models():
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{VLLM_URL}/v1/models")
            if r.status_code == 200:
                j = r.json()
                data = j.get("data", [])
                ids = {m.get("id") for m in data}
                for m_id in [MODEL, "google/gemma-4-26b-a4b-nvfp4", "seedinfer/gemma-4-26b-a4b"]:
                    if m_id not in ids:
                        data.append({
                            "id": m_id, "object": "model", "created": 1735689600,
                            "owned_by": "seedinfer",
                            "context_length": 262144, "max_output": 262144,
                            "vllm_model": VLLM_MODEL,
                        })
                out: dict[str, Any] = {"object": "list", "data": data}
                for k in ("chat_template", "tokenizer_config", "hf_model"):
                    if k in j and k not in out:
                        out[k] = j[k]
                return JSONResponse(out)
    except Exception as e:
        log.debug("proxy /v1/models failed: %s", e)

    return JSONResponse({
        "object": "list",
        "data": [
            {
                "id": MODEL, "object": "model", "created": 1735689600,
                "owned_by": "seedinfer",
                "context_length": 262144, "max_output": 262144,
                "description": "Gemma 4 26B A4B NVFP4 - High performance MoE model for OpenRouter & SeedInfer P2P",
                "pricing": {"prompt": "0.00002", "completion": "0.00005", "cache_read": "0.0"},
                "hf_model": VLLM_MODEL,
            },
            {
                "id": "seedinfer/gemma-4-26b-a4b", "object": "model", "created": 1735689600,
                "owned_by": "seedinfer",
                "context_length": 262144, "max_output": 262144,
                "description": "Alias for google/gemma-4-26b-a4b-nvfp4",
            }
        ]
    })

@app.get("/metrics")
async def metrics():
    gi = gpu_info()
    hi = host_info()
    vh = await vllm_health()
    return {
        "provider_id": PROVIDER_ID,
        "model": MODEL,
        "gpu": gi,
        "host": hi,
        "vllm_health": vh,
        "active_requests": active_requests,
        "median_prompt_tokens": get_current_median_prompt_tokens(),
        "requests_served": _requests_served,
        "tokens_generated": _tokens_generated,
        "uptime_s": int(time.time() - _start_ts),
    }

# --- Dynamic Rolling Median & Adaptive Priority Core ---
from collections import deque
import statistics

prompt_token_history = deque(maxlen=100)
prompt_token_history.extend([1000] * 10)  # Seed median ~1000 tokens

def record_prompt_tokens(tokens: int):
    if tokens > 0:
        prompt_token_history.append(tokens)

def get_current_median_prompt_tokens() -> float:
    if not prompt_token_history:
        return 1000.0
    return float(statistics.median(prompt_token_history))

def calculate_request_priority(body: dict, headers: Any, active_slots: int) -> tuple[int, int]:
    """Calculates adaptive request priority (0 = HIGH, 5 = MEDIUM, 10-15 = LOW).
    Uses dynamic rolling median of recent prompt token lengths on this node
    and factors in current active slot saturation to protect TTFT p99.
    """
    if "x-vllm-priority" in headers:
        try:
            return int(headers["x-vllm-priority"]), 0
        except ValueError:
            pass
    if "priority" in body:
        try:
            return int(body["priority"]), 0
        except (ValueError, TypeError):
            pass

    total_chars = 0
    try:
        messages = body.get("messages", [])
        for m in messages:
            content = m.get("content", "")
            if isinstance(content, str):
                total_chars += len(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        total_chars += len(part.get("text", ""))
        approx_tokens = max(1, int(total_chars // 3.8))
    except Exception:
        approx_tokens = 1000

    median = get_current_median_prompt_tokens()

    # Adaptive priority tier relative to node's rolling median
    if approx_tokens <= median:
        priority = 0  # Below median -> HIGH priority (premiowanie niskiego TTFT)
    elif approx_tokens <= 2.5 * median:
        priority = 5 if active_slots <= 24 else 10
    else:
        priority = 10 if active_slots <= 24 else 15

    return priority, approx_tokens

_cached_vllm_model: Optional[str] = None
_cached_vllm_model_ts: float = 0.0

async def get_cached_vllm_model(orig_model: str) -> str:
    global _cached_vllm_model, _cached_vllm_model_ts
    now = time.time()
    if _cached_vllm_model and (now - _cached_vllm_model_ts) < 60.0:
        return _cached_vllm_model if orig_model not in (_cached_vllm_model, MODEL) else orig_model

    try:
        async with httpx.AsyncClient(timeout=2) as c:
            r = await c.get(f"{VLLM_URL}/v1/models")
            if r.status_code == 200:
                vllm_models = [m.get("id") for m in r.json().get("data", []) if isinstance(m, dict)]
                if vllm_models:
                    _cached_vllm_model = vllm_models[0]
                    _cached_vllm_model_ts = now
                    if orig_model not in vllm_models:
                        return vllm_models[0]
    except Exception:
        pass
    return orig_model

@app.post("/v1/chat/completions")
@app.post("/api/v1/chat/completions")
async def priority_chat_completions(request: Request):
    global active_requests, _requests_served, _tokens_generated

    # 1) Concurrency Guard: Enforce hard limit of MAX_CONCURRENT_REQUESTS (32 slots)
    async with active_requests_lock:
        if active_requests >= MAX_CONCURRENT_REQUESTS:
            log.warning("Slot saturation: %d/%d active requests — returning 429", active_requests, MAX_CONCURRENT_REQUESTS)
            return Response(
                status_code=429,
                headers={"Retry-After": "1"},
                content=json.dumps({"error": "Too Many Requests", "message": "Capacity saturated", "retry_after": 1}),
                media_type="application/json",
            )
        active_requests += 1

    _requests_served += 1
    t0 = time.perf_counter()

    try:
        try:
            req_bytes = await request.body()
            body = json.loads(req_bytes) if req_bytes else {}
        except Exception:
            return JSONResponse({"error": {"message": "Invalid JSON payload", "type": "invalid_request_error"}}, status_code=400)

        # 2) Resolve served model
        orig_model = body.get("model", MODEL)
        body["model"] = await get_cached_vllm_model(orig_model)

        # 3) Priority Scheduling Injection (Adaptive Rolling Median)
        priority_val, approx_tokens = calculate_request_priority(body, request.headers, active_requests)
        body["priority"] = priority_val
        if approx_tokens > 0:
            record_prompt_tokens(approx_tokens)

        is_stream = bool(body.get("stream", False))
        if is_stream:
            if "stream_options" not in body:
                body["stream_options"] = {"include_usage": True}
            else:
                body["stream_options"]["include_usage"] = True

        fwd_headers = {"X-Vllm-Priority": str(priority_val), "Content-Type": "application/json"}
        auth = request.headers.get("authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        elif PROVIDER_API_KEY:
            fwd_headers["Authorization"] = f"Bearer {PROVIDER_API_KEY}"

        log.info("Proxying request [priority=%d, stream=%s, model=%s] active=%d/%d",
                 priority_val, is_stream, body.get("model"), active_requests, MAX_CONCURRENT_REQUESTS)
    except Exception as setup_err:
        async with active_requests_lock:
            active_requests = max(0, active_requests - 1)
        log.error("Unhandled error setup in priority_chat_completions: %s", setup_err)
        return JSONResponse({"error": {"message": str(setup_err), "type": "internal_error"}}, status_code=500)

    # 4) Non-streaming path
    if not is_stream:
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                r = await client.post(f"{VLLM_URL}/v1/chat/completions", json=body, headers=fwd_headers)
                t1 = time.perf_counter()
                latency_ms = (t1 - t0) * 1000
                
                try:
                    resp_json = r.json()
                    usage = resp_json.get("usage", {})
                    comp_tok = usage.get("completion_tokens", 0)
                    prompt_tok = usage.get("prompt_tokens", 0)
                    _tokens_generated += comp_tok
                    
                    log.info("🔥 NON-STREAMING REPORT: Prompt=%d tok, Gen=%d tok, Total time=%.2f ms | Priority=%d",
                             prompt_tok, comp_tok, latency_ms, priority_val)
                    
                    if orig_model and isinstance(resp_json, dict):
                        resp_json["model"] = orig_model
                        return JSONResponse(content=resp_json, status_code=r.status_code)
                except Exception:
                    pass
                return Response(content=r.content, status_code=r.status_code, media_type="application/json")
        finally:
            async with active_requests_lock:
                active_requests = max(0, active_requests - 1)

    # 5) Streaming path with direct telemetry & zero buffering
    async def priority_stream_generator():
        global active_requests, _tokens_generated
        ttft_ms = None
        first_token_time = None
        completion_tokens = 0
        prompt_tokens = 0

        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream("POST", f"{VLLM_URL}/v1/chat/completions", json=body, headers=fwd_headers) as r:
                    if r.status_code != 200:
                        err_content = await r.aread()
                        yield err_content
                        return

                    async for line in r.aiter_lines():
                        if not line:
                            continue

                        # Parse SSE for performance telemetry (TTFT & TPS)
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str != "[DONE]":
                                try:
                                    parsed = json.loads(data_str)
                                    if ttft_ms is None and parsed.get("choices"):
                                        delta = parsed["choices"][0].get("delta", {})
                                        if delta.get("content") or delta.get("reasoning_content") or delta.get("reasoning"):
                                            first_token_time = time.perf_counter()
                                            ttft_ms = (first_token_time - t0) * 1000

                                    if parsed.get("choices"):
                                        delta = parsed["choices"][0].get("delta", {})
                                        if delta.get("content") or delta.get("reasoning_content") or delta.get("reasoning"):
                                            completion_tokens += 1
                                            _tokens_generated += 1

                                    if parsed.get("usage"):
                                        prompt_tokens = parsed["usage"].get("prompt_tokens", prompt_tokens)
                                        if parsed["usage"].get("completion_tokens"):
                                            completion_tokens = parsed["usage"].get("completion_tokens")
                                except Exception:
                                    pass

                        if line.startswith("data:"):
                            yield (line + "\n\n").encode("utf-8")
                        else:
                            yield (line + "\n").encode("utf-8")

                    # Log llama.cpp style request performance report
                    t1 = time.perf_counter()
                    total_time_ms = (t1 - t0) * 1000
                    if ttft_ms is not None:
                        decode_time = t1 - first_token_time if first_token_time else 0.01
                        decode_time = max(0.01, decode_time)
                        true_tps = completion_tokens / decode_time
                        prefill_tps = prompt_tokens / (ttft_ms / 1000.0) if ttft_ms > 0 else 0

                        log.info("\n============================================================"
                                 "\n🔥 REQUEST PERFORMANCE REPORT (Gemma 4 Priority Proxy)"
                                 "\n============================================================"
                                 "\nPriority:                  %d"
                                 "\nPrompt Eval Time (Prefill): %.2f ms | %d tokens (%.2f tok/s)"
                                 "\nEval Time (Decode/Gen):    %.2f ms | %d tokens (%.2f tok/s)"
                                 "\nTotal Response Time:        %.2f ms"
                                 "\n============================================================",
                                 priority_val, ttft_ms, prompt_tokens, prefill_tps,
                                 decode_time * 1000, completion_tokens, true_tps, total_time_ms)
        finally:
            async with active_requests_lock:
                active_requests = max(0, active_requests - 1)

    return StreamingResponse(
        priority_stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
    )

@app.post("/v1/completions")
async def completions(request: Request):
    body = await request.body()
    fwd_headers: dict[str, str] = {"Content-Type": "application/json"}
    auth = request.headers.get("authorization")
    if auth:
        fwd_headers["Authorization"] = auth
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=5)) as c:
            r = await c.post(f"{VLLM_URL}/v1/completions", content=body, headers=fwd_headers)
            return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))
    except Exception as e:
        return JSONResponse({"error": {"message": str(e), "type": "server_error", "code": "proxy_error"}}, status_code=500)

def _handle_sigterm(*_):
    log.info("SIGTERM received")
    _stop.set()

try:
    signal.signal(signal.SIGTERM, _handle_sigterm)
    signal.signal(signal.SIGINT, _handle_sigterm)
except Exception:
    pass

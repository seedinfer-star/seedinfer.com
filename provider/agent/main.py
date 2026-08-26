"""SeedInfer Provider Agent — FastAPI (Faza 0)
CUDA only, proxy do vLLM nightly, GPU via pynvml, heartbeat co 30s do gateway.
Kompatybilny z lib/types.ts Provider (provider-fleet).
Expose: 3001 (agent) — vLLM na 8000.
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

# --- config via env ---
AGENT_PORT = int(os.getenv("AGENT_PORT", "3001"))
VLLM_URL = os.getenv("VLLM_URL", f"http://127.0.0.1:{os.getenv('VLLM_PORT','8000')}")
GATEWAY_URL = os.getenv("SEEDINFER_GATEWAY_URL", "https://seedinfer.com").rstrip("/")
PROVIDER_API_KEY = os.getenv("PROVIDER_API_KEY") or os.getenv("SEEDINFER_API_KEY") or ""
MODEL = os.getenv("MODEL", "seedinfer/nemotron-lightning-1m")
# Plug-and-play NVFP4 default — must match provider/.env.example & docker-compose.yml
VLLM_MODEL = os.getenv("VLLM_MODEL", "") or MODEL
if not VLLM_MODEL or VLLM_MODEL == "seedinfer/nemotron-lightning-1m":
    # Fallback to real HF repo for NVFP4 if user left logical id
    # Only override when VLLM_MODEL unset (AGENT sees MODEL canonical)
    # Check env directly: jeśli VLLM_MODEL env empty, użyj NVFP4
    _env_vllm = os.getenv("VLLM_MODEL", "")
    if not _env_vllm:
        VLLM_MODEL = "nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4"
PROVIDER_ID_ENV = os.getenv("PROVIDER_ID", "")
PROVIDER_REGION = os.getenv("PROVIDER_REGION", "pl-central")
TAILSCALE_HOSTNAME = os.getenv("TAILSCALE_HOSTNAME", "")
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "30"))
LOG_LEVEL = os.getenv("AGENT_LOG_LEVEL", "info").upper()
AGENT_VERSION = "0.1.0-nvfp4-faza0"

logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO),
                    format="%(asctime)s %(levelname)s [agent] %(message)s")
log = logging.getLogger("seedinfer-provider")

# --- provider id (stabilny) ---
def _provider_id() -> str:
    if PROVIDER_ID_ENV:
        return PROVIDER_ID_ENV
    # hostname + mac hash
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

# stats
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
            try:
                bw = 0  # memory bandwidth not via nvml — estimate
            except Exception:
                bw = 0
            devs.append({
                "index": i, "name": name,
                "memory_total_mb": int(mem.total // 1024 // 1024),
                "memory_used_mb": int(mem.used // 1024 // 1024),
                "memory_free_mb": int(mem.free // 1024 // 1024),
                "util_gpu": int(gpu_util), "util_memory": int(mem_util),
                "temperature_c": int(temp),
            })
        # gpu_cores est: RTX 5090 ~ 21760 CUDA cores; fallback n* 2048
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
    """Zwraca IPv4 z Tailscale if available (do heartbeat verification)."""
    # 1) env override
    env_ip = os.getenv("TAILSCALE_IP", "")
    if env_ip:
        return env_ip.strip()
    # 2) tailscale CLI
    try:
        import subprocess  # noqa: WPS433
        out = subprocess.check_output(["tailscale", "ip", "-4"], timeout=2, stderr=subprocess.DEVNULL)
        ip = out.decode().strip().splitlines()[0].strip() if out else ""
        if ip and ip.startswith("100."):
            return ip
    except Exception:
        pass
    # 3) try host network interfaces via tailnet hostname DNS?
    return ""

def _agent_url() -> str:
    ip = _tailscale_ip()
    if ip:
        return f"http://{ip}:{AGENT_PORT}"
    hn = TAILSCALE_HOSTNAME or ""
    if hn:
        # MagicDNS candidate
        return f"http://{hn}.seedinfer.ts.net:{AGENT_PORT}"
    # fallback: hostname
    try:
        return f"http://{socket.gethostname()}:{AGENT_PORT}"
    except Exception:
        return f"http://127.0.0.1:{AGENT_PORT}"

async def vllm_health() -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{VLLM_URL}/health")
            if r.status_code == 200:
                return {"status": "ok", "code": r.status_code}
            # fallback: /v1/models
            r2 = await c.get(f"{VLLM_URL}/v1/models")
            return {"status": "ok" if r2.status_code == 200 else "degraded", "code": r2.status_code}
    except Exception as e:
        return {"status": "down", "error": str(e)}

# --- heartbeat ---
_heartbeat_task: Optional[asyncio.Task] = None
_stop = asyncio.Event()

def build_provider_payload() -> dict[str, Any]:
    gi = gpu_info()
    hi = host_info()
    # map to lib/types.ts Provider — minimal wymagane + live
    dev_name = gi["devices"][0]["name"] if gi["devices"] else "unknown-cuda"
    mem_gb = gi["total_memory_gb"] or hi["memory_gb"] or 0
    # decode_tps est from? 0 until measured
    # NVFP4: enrich with tailscale/agent_url for gateway verification
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
        "memory_bandwidth_gbs": 1008,  # RTX 5090 ~1TB/s; generic
        "current_model": MODEL,
        "models": [MODEL],
        "status": "serving",
        "trust_level": "software",
        "attested": False,
        "requests_served": _requests_served,
        "tokens_generated": _tokens_generated,
        "machine_model": hi["platform"],
        "decode_tps": 0,
        # live extras dla gateway
        "gpu": gi,
        "host": hi,
        "uptime_s": int(time.time() - _start_ts),
        "vllm_model": VLLM_MODEL,
        "region": PROVIDER_REGION,
        "agent_version": AGENT_VERSION,
        "tailscale_ip": tailscale_ip,
        "agent_url": agent_url,
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
            # vllm live check enrich
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
                    else:
                        log.warning("heartbeat %s -> %s %s", hb_url, r.status_code, r.text[:300])
                except Exception as e:
                    log.warning("heartbeat %s failed: %s", hb_url, e)
            try:
                await asyncio.wait_for(_stop.wait(), timeout=HEARTBEAT_INTERVAL)
            except asyncio.TimeoutError:
                continue

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("agent start id=%s model=%s vllm=%s gateway=%s", PROVIDER_ID, MODEL, VLLM_URL, GATEWAY_URL)
    _stop.clear()
    global _heartbeat_task
    _heartbeat_task = asyncio.create_task(heartbeat_loop())
    yield
    log.info("agent shutdown — stopping heartbeat")
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

app = FastAPI(title="SeedInfer Provider Agent", version="0.1.0-faza0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# --- routes ---
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
        "requests_served": _requests_served,
        "uptime_s": int(time.time() - _start_ts),
    }

@app.get("/v1/models")
@app.get("/api/v1/models")
async def list_models():
    # OpenAI-compatible — try proxy to vLLM, fallback to static
    # vLLM używa chat_template z HF (tokenizer_config.json) automatycznie — nie nadpisujemy, ale forward chat_template jeśli obecny
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{VLLM_URL}/v1/models")
            if r.status_code == 200:
                j = r.json()
                data = j.get("data", [])
                # forward chat_template if vLLM includes (rare but preserve)
                ids = {m.get("id") for m in data}
                if MODEL not in ids:
                    data.append({
                        "id": MODEL, "object": "model", "created": 1735689600,
                        "owned_by": "seedinfer",
                        "context_length": 1048576, "max_output": 1048576,
                        "vllm_model": VLLM_MODEL,
                    })
                # jeśli vLLM zwrócił chat_template w top-level lub per-model, zachowaj
                out: dict[str, Any] = {"object": "list", "data": data}
                # preserve possible top-level fields
                for k in ("chat_template", "tokenizer_config", "hf_model"):
                    if k in j and k not in out:
                        out[k] = j[k]
                return JSONResponse(out)
    except Exception as e:
        log.debug("proxy /v1/models failed: %s", e)
    # fallback static (zgodny z app/api/v1/models/route.ts)
    return JSONResponse({
        "object": "list",
        "data": [{
            "id": MODEL, "object": "model", "created": 1735689600,
            "owned_by": "seedinfer",
            "context_length": 1048576, "max_output": 1048576,
            "description": "Nemotron Lightning 1M (2M KV) - $0.02/1M in $0.05/1M out cache 60s free",
            "pricing": {"prompt": "0.00002", "completion": "0.00005", "cache_read": "0.0"},
            "hf_model": VLLM_MODEL,
            "note": "vLLM używa chat_template z HF (tokenizer_config.json) automatycznie — jinja template od nvidia",
        }, {
            "id": "gpt-oss-20b", "object": "model", "created": 1735689600,
            "owned_by": "seedinfer",
            "context_length": 1048576, "max_output": 1048576,
            "description": "Alias for seedinfer/nemotron-lightning-1m",
        }]
    })

@app.get("/v1/chat/template")
@app.get("/api/v1/chat/template")
async def chat_template():
    """Proxy dla jinja chat_template z HF / vLLM.
    vLLM nie expose bezpośrednio /v1/chat/template, ale template jest w HF repo
    (nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 tokenizer_config.json).
    Endpoint próbuje: 1) proxy vLLM jeśli ma, 2) fetch HF raw, 3) fallback lokalny.
    """
    # 1) try proxy vLLM
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            for path in ("/v1/chat/template", "/tokenizer_config.json", "/v1/models"):
                try:
                    r = await c.get(f"{VLLM_URL}{path}")
                    if r.status_code == 200:
                        j = r.json() if "json" in r.headers.get("content-type","") else {"raw": r.text[:5000]}
                        # jeśli ma chat_template, zwróć
                        if isinstance(j, dict) and ("chat_template" in j or "chat_template" in str(j)[:2000]):
                            return JSONResponse({"source": f"vllm:{path}", "data": j, "model": MODEL, "vllm_model": VLLM_MODEL})
                except Exception:
                    continue
    except Exception:
        pass
    # 2) fetch from HF hub raw
    try:
        hf_url = f"https://huggingface.co/{VLLM_MODEL}/raw/main/tokenizer_config.json"
        async with httpx.AsyncClient(timeout=10) as c:
            h = {}
            if os.getenv("HF_TOKEN"):
                h["Authorization"] = f"Bearer {os.getenv('HF_TOKEN')}"
            r = await c.get(hf_url, headers=h)
            if r.status_code == 200:
                j = r.json()
                ct = j.get("chat_template")
                return JSONResponse({
                    "source": "hf:tokenizer_config.json",
                    "model": MODEL,
                    "vllm_model": VLLM_MODEL,
                    "chat_template": ct,
                    "tokenizer_config": j,
                    "note": "vLLM używa tego template automatycznie — nie trzeba nadpisywać"
                })
    except Exception as e:
        log.debug("chat_template HF fetch failed: %s", e)
    # 3) fallback — hint
    return JSONResponse({
        "model": MODEL,
        "vllm_model": VLLM_MODEL,
        "chat_template": None,
        "note": "chat_template z HF nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 (jinja) — vLLM użyje automatycznie z HF. Zobacz https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4/blob/main/tokenizer_config.json",
        "hf_url": f"https://huggingface.co/{VLLM_MODEL}/blob/main/tokenizer_config.json",
        "hint": "curl -H 'Authorization: Bearer $HF_TOKEN' https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4/raw/main/tokenizer_config.json | jq .chat_template"
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
        "requests_served": _requests_served,
        "tokens_generated": _tokens_generated,
        "uptime_s": int(time.time() - _start_ts),
    }

async def _proxy_stream(req_body: bytes, headers: dict, is_stream: bool):
    """Proxy streaming response from vLLM to client."""
    # httpx streaming
    client_headers = {k: v for k, v in headers.items() if k.lower() not in ("host", "content-length")}
    # forward auth if present
    async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10)) as client:
        async with client.stream("POST", f"{VLLM_URL}/v1/chat/completions",
                                 content=req_body, headers={**client_headers, "Content-Type": "application/json"}) as r:
            # propagate status
            if r.status_code != 200 and not is_stream:
                body = await r.aread()
                yield body
                return
            async for chunk in r.aiter_bytes():
                if chunk:
                    yield chunk

@app.post("/v1/chat/completions")
@app.post("/api/v1/chat/completions")
async def chat_completions(request: Request):
    global _requests_served, _tokens_generated
    body = await request.body()
    try:
        j = json.loads(body) if body else {}
    except Exception:
        return JSONResponse({"error": {"message": "Invalid JSON", "type": "invalid_request_error", "code": "invalid_json"}}, status_code=400)
    is_stream = bool(j.get("stream"))
    # count request
    _requests_served += 1
    # Translate logical SeedInfer model to actual vLLM served name (nemotron container serves nemotron-3.5-lightning-30b-a3b-nvfp4)
    _orig_model = j.get("model")
    _model_aliased = False
    if _orig_model == "seedinfer/nemotron-lightning-1m":
        j["model"] = "nemotron-3.5-lightning-30b-a3b-nvfp4"
        body = json.dumps(j).encode()
        _model_aliased = True

    # proxy to vLLM
    try:
        fwd_headers: dict[str, str] = {}
        auth = request.headers.get("authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        elif PROVIDER_API_KEY:
            fwd_headers["Authorization"] = f"Bearer {PROVIDER_API_KEY}"

        if is_stream:
            # streaming: forward as event-stream
            async def gen() -> AsyncGenerator[bytes, None]:
                async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=5)) as client:
                    async with client.stream("POST", f"{VLLM_URL}/v1/chat/completions",
                                             content=body,
                                             headers={**fwd_headers, "Content-Type": "application/json"}) as r:
                        if r.status_code != 200:
                            # read error and emit as JSON
                            err = await r.aread()
                            yield err
                            return
                        async for chunk in r.aiter_bytes():
                            if chunk:
                                # rough tokens estimate
                                yield chunk
            return StreamingResponse(gen(), media_type="text/event-stream",
                                     headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
        else:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=5)) as client:
                r = await client.post(f"{VLLM_URL}/v1/chat/completions",
                                      content=body,
                                      headers={**fwd_headers, "Content-Type": "application/json"})
                # propagate response
                ct = r.headers.get("content-type", "application/json")
                # try token counting and map model back for gateway verification
                try:
                    resp_j = r.json()
                    usage = resp_j.get("usage", {})
                    _tokens_generated += int(usage.get("completion_tokens", 0) or 0)
                    if _model_aliased and isinstance(resp_j, dict) and resp_j.get("model") == "nemotron-3.5-lightning-30b-a3b-nvfp4":
                        resp_j["model"] = _orig_model
                        return JSONResponse(content=resp_j, status_code=r.status_code)
                except Exception:
                    pass
                return Response(content=r.content, status_code=r.status_code, media_type=ct,
                                headers={"Cache-Control": "no-store"})
    except httpx.ConnectError as e:
        log.error("vLLM connect failed: %s", e)
        return JSONResponse({
            "error": {
                "message": f"vLLM unavailable at {VLLM_URL}: {e}. Faza 0 — sprawdź czy kontener provider ma GPU i model {MODEL}",
                "type": "service_unavailable", "code": "vllm_down",
                "hint": "docker logs seedinfer-provider; nvidia-smi"
            }
        }, status_code=503)
    except Exception as e:
        log.exception("proxy error")
        return JSONResponse({"error": {"message": str(e), "type": "server_error", "code": "proxy_error"}}, status_code=500)

# also support /v1/completions (legacy)
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

# graceful on SIGTERM handled by uvicorn; also capture
def _handle_sigterm(*_):
    log.info("SIGTERM received")
    _stop.set()

try:
    signal.signal(signal.SIGTERM, _handle_sigterm)
    signal.signal(signal.SIGINT, _handle_sigterm)
except Exception:
    pass

"use client"
import { useState } from "react"
import Link from "next/link"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Server, Terminal, Cpu, HardDrive, Zap, FileText, ShieldCheck, Activity, Download, KeyRound, ExternalLink, AlertTriangle, Clock, Globe, Wrench } from "lucide-react"

const ONE_LINER_RECOMMENDED = `curl -fsSL https://seedinfer.com/install.sh | bash`
const ONE_LINER_SIMPLE = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey YOUR_AUTHKEY`
const ONE_LINER_AUTO = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey $(curl -s https://seedinfer.com/api/v1/auth/request | jq -r .authkey)`
const ONE_LINER_CUSTOM = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey YOUR_AUTHKEY --model seedinfer/nemotron-lightning-1m --gateway https://seedinfer.com --hostname provider-5090`

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1 font-mono text-[11px] text-text-secondary hover:bg-bg-hover hover:text-text-primary"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label || "Copy"}
    </button>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div>
      {label && <div className="mb-1.5 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">{label}</span><CopyButton text={code} /></div>}
      <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-xs leading-4 text-text-secondary whitespace-pre-wrap break-all">{code}</pre>
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">SeedInfer Docs · Hardware & Setup</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              Required hardware · NVFP4 1M ctx · CUDA 13.3 · RTX 5090 32GB min · 47900/47901 · install.sh
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/providers" className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary">
              <Activity className="h-3.5 w-3.5" /> Fleet
            </Link>
            <Link href="/provider" className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-brand-hover">
              <Server className="h-3.5 w-3.5" /> Become a Provider →
            </Link>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">

            {/* Hero */}
            <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success" className="gap-1"><ShieldCheck className="h-3 w-3" /> Faza 0 · NVFP4</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">seedinfer/nemotron-lightning-1m</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">1M ctx · 2M KV</Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">CUDA 13.3 · driver 580.65+</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">47900:8000 · 47901:3001</Badge>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">SeedInfer Docs — run your own node</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-5 text-text-secondary">
                      <code className="rounded bg-bg-tertiary px-1 font-mono text-xs">seedinfer/nemotron-lightning-1m</code> (NVIDIA Nemotron 3.5 Lightning 30B A3B NVFP4 — 30B/3B MoE+Mamba, 1M ctx) on <strong className="text-text-primary">RTX 5090 32GB (GB202, Blackwell)</strong>. Earn <strong className="text-text-primary">$0.02 / 1M input</strong> + <strong className="text-text-primary">$0.05 / 1M output</strong>. Tailscale Headscale + vLLM nightly + heartbeat.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href="#hardware" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">Hardware ↓</a>
                      <a href="#install" className="inline-flex items-center gap-1 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover"><Terminal className="h-3.5 w-3.5" /> One-liner install ↓</a>
                      <a href="#verify" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">Verify ↓</a>
                      <a href="/provider" className="inline-flex items-center gap-1 font-mono text-xs text-accent-brand hover:underline">/provider → full guide</a>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3 max-w-xl">
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Input</div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">$0.02 / 1M</div>
                        <div className="font-mono text-[10px] text-text-tertiary">prompt tokens</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Output</div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">$0.05 / 1M</div>
                        <div className="font-mono text-[10px] text-text-tertiary">completion tokens</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Context</div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">1M · 2M KV</div>
                        <div className="font-mono text-[10px] text-text-tertiary">~22-28 GB VRAM</div>
                      </div>
                    </div>
                  </div>
                  <Card className="w-full shrink-0 border border-border-dim bg-bg-primary/60 lg:w-[380px]">
                    <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary"><ShieldCheck className="h-3.5 w-3.5" /> Quick requirements</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5 pt-0 font-mono text-xs">
                      <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2"><span className="text-text-tertiary">Model</span><span className="font-medium text-text-primary">NVFP4 1M $0.02/$0.05</span></div>
                      <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2"><span className="text-text-tertiary">GPU min</span><span className="font-medium text-accent-brand">RTX 5090 32GB</span></div>
                      <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2"><span className="text-text-tertiary">VRAM</span><span className="font-medium text-text-primary">22-28GB (16-22+6 KV)</span></div>
                      <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2"><span className="text-text-tertiary">OS</span><span className="font-medium text-text-primary">Ubuntu 24.04 noble</span></div>
                      <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2"><span className="text-text-tertiary">Driver / CUDA</span><span className="font-medium text-text-primary">580.65+ / 13.3</span></div>
                      <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2"><span className="text-text-tertiary">Ports</span><span className="font-medium text-text-primary">47900:8000 + 47901:3001</span></div>
                      <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2"><span className="text-text-tertiary">Disk</span><span className="font-medium text-text-primary">60GB+ free (df -h)</span></div>
                      <div className="rounded-lg border border-dashed border-border-default bg-bg-secondary p-2.5 font-mono text-[11px] leading-3 text-text-secondary">NVFP4 flags host 1:1: <code className="rounded bg-bg-tertiary px-1">marlin</code> + <code className="rounded bg-bg-tertiary px-1">flashinfer</code> + <code className="rounded bg-bg-tertiary px-1">fp8</code> · <code>0.93/1048576/128/4096</code></div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* VRAM math */}
            <Card id="hardware" className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-[13px]"><HardDrive className="h-4 w-4 text-accent-brand" /> VRAM math — dlaczego 32GB</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Wagi NVFP4</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-text-primary">16-22 GB</div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">W4A16 + FP8 via ModelOpt (vs 66GB BF16). On-disk ~20-30GB download z HF.</div>
                  </div>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">KV cache 1M</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-text-primary">~6 GB</div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">FP8 KV, 1M tokens, <code className="rounded bg-bg-tertiary px-1">--kv-cache-dtype fp8</code>. 2M KV max = ~12GB at full buffer.</div>
                  </div>
                  <div className="rounded-xl border border-accent-brand/20 bg-accent-brand/10 p-4">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-accent-brand">Total + headroom</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-text-primary">22-28 GB</div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">+ <code>--gpu-memory-utilization 0.93</code> + <code>--max-num-batched-tokens 4096</code> → 32GB daje ~4-10GB zapasu. Na 24GB OOM bez downscale.</div>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-border-default bg-bg-primary p-3 font-mono text-[11px] leading-4 text-text-secondary">
                  <strong className="text-text-primary">On OOM:</strong> lower <code className="rounded bg-bg-tertiary px-1">VLLM_GPU_MEMORY_UTILIZATION=0.80</code> + <code className="rounded bg-bg-tertiary px-1">VLLM_MAX_MODEL_LEN=32768</code> or <code>131072</code>. Only then is 24GB (3090/4090) stable — see 24GB tier plan below.
                </div>
              </CardContent>
            </Card>

            {/* GPU matrix */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]"><Cpu className="h-4 w-4 text-accent-brand" /> GPU Matrix — minimum RTX 5090 32GB (Blackwell)</CardTitle>
                <p className="font-mono text-xs text-text-tertiary">Minimum <strong className="text-text-primary">RTX 5090 32GB (GB202, Blackwell sm_120, 21760 CUDA, 680 Tensor 5th gen, 32GB GDDR7 ~1.8 TB/s)</strong>. NVFP4 host env <code className="rounded bg-bg-tertiary px-1">VLLM_ATTENTION_BACKEND=FLASHINFER</code> + <code className="rounded bg-bg-tertiary px-1">VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass</code> + <code className="rounded bg-bg-tertiary px-1">VLLM_MOE_BACKEND=marlin</code> + <code className="rounded bg-bg-tertiary px-1">VLLM_MAMBA_BACKEND=flashinfer</code>. A100/H100 auto-fallback <code>humming</code>.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr><th className="px-3 py-2">GPU</th><th className="px-3 py-2">Arch</th><th className="px-3 py-2">VRAM</th><th className="px-3 py-2">BW</th><th className="px-3 py-2">NVFP4 1M</th><th className="px-3 py-2">Est. tput*</th><th className="px-3 py-2">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr className="bg-accent-brand/10 font-medium text-text-primary"><td className="px-3 py-2">RTX 5090 32GB</td><td className="px-3 py-2">GB202 sm_120</td><td className="px-3 py-2">32GB GDDR7</td><td className="px-3 py-2">~1.8 TB/s</td><td className="px-3 py-2">✅ ~22-28GB</td><td className="px-3 py-2">~120-180 tok/s</td><td className="px-3 py-2"><Badge variant="success" className="text-[10px]">minimum</Badge></td></tr>
                      <tr><td className="px-3 py-2">A100 40GB</td><td className="px-3 py-2">GA100 sm_80</td><td className="px-3 py-2">40GB HBM2e</td><td className="px-3 py-2">1.6 TB/s</td><td className="px-3 py-2">✅ W4A16</td><td className="px-3 py-2">~60-90</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr><td className="px-3 py-2">A100 80GB</td><td className="px-3 py-2">GA100</td><td className="px-3 py-2">80GB HBM2e</td><td className="px-3 py-2">2.0 TB/s</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">~70-100</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr><td className="px-3 py-2">H100 80GB</td><td className="px-3 py-2">H100 sm_90</td><td className="px-3 py-2">80GB HBM3</td><td className="px-3 py-2">3.0 TB/s</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">~150-220</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr><td className="px-3 py-2">L40S 48GB</td><td className="px-3 py-2">AD102 sm_89</td><td className="px-3 py-2">48GB GDDR6</td><td className="px-3 py-2">864 GB/s</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">~80-120</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr><td className="px-3 py-2">RTX 6000 Ada 48GB</td><td className="px-3 py-2">AD102</td><td className="px-3 py-2">48GB GDDR6</td><td className="px-3 py-2">960 GB/s</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">~80-120</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr><td className="px-3 py-2">RTX 6000 Pro Blackwell</td><td className="px-3 py-2">GB202</td><td className="px-3 py-2">96GB GDDR7</td><td className="px-3 py-2">~1.8 TB/s+</td><td className="px-3 py-2">✅ 96GB</td><td className="px-3 py-2">~130-190</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr><td className="px-3 py-2">RTX 4500 Blackwell 32GB</td><td className="px-3 py-2">GB203</td><td className="px-3 py-2">32GB GDDR7</td><td className="px-3 py-2">~1.0 TB/s</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">~90-130</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr><td className="px-3 py-2">RTX 5000 Blackwell</td><td className="px-3 py-2">GB203</td><td className="px-3 py-2">32-48GB GDDR7</td><td className="px-3 py-2">~1.2 TB/s</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">~110-160</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td></tr>
                      <tr className="opacity-60"><td className="px-3 py-2">RTX 3090 24GB ⏳</td><td className="px-3 py-2">GA102 sm_86</td><td className="px-3 py-2">24GB GDDR6X</td><td className="px-3 py-2">936 GB/s</td><td className="px-3 py-2">⚠️ tight 24GB</td><td className="px-3 py-2">~50-80</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">plan</Badge></td></tr>
                      <tr className="opacity-60"><td className="px-3 py-2">RTX 4090 24GB ⏳</td><td className="px-3 py-2">AD102 sm_89</td><td className="px-3 py-2">24GB GDDR6X</td><td className="px-3 py-2">1.0 TB/s</td><td className="px-3 py-2">⚠️ tight</td><td className="px-3 py-2">~70-100</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">plan</Badge></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-dashed border-border-default bg-bg-primary p-3 font-mono text-[11px] leading-4 text-text-secondary">
                  * Est. tput single-user prefill+decode for Nemotron 30B NVFP4 (W4A16+FP8 KV), batch 1, 1k in / 256 out, no prefix cache. Real throughput depends on marlin (Blackwell FP4 + flashinfer-cutlass) / humming (A100 W4A16) + KV hit.<br />
                  <strong className="text-text-primary">Eventually 3090/4090 (24GB)</strong> — planned as &quot;community&quot; tier z auto-downscale <code className="rounded bg-bg-tertiary px-1">VLLM_MAX_MODEL_LEN=131072</code> + <code className="rounded bg-bg-tertiary px-1">VLLM_GPU_MEMORY_UTILIZATION=0.85</code>. Currently welcome for testing, but the official minimum is 32GB.
                </div>
              </CardContent>
            </Card>

            {/* OS / Driver / CUDA matrix */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-[13px]"><Wrench className="h-4 w-4 text-accent-brand" /> OS / Driver / CUDA matrix</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr><th className="px-3 py-2">Stack</th><th className="px-3 py-2">Wersja wymagana</th><th className="px-3 py-2">Blackwell GB202</th><th className="px-3 py-2">Fallback</th><th className="px-3 py-2">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr className="bg-accent-brand/5"><td className="px-3 py-2 font-medium text-text-primary">OS</td><td className="px-3 py-2">Ubuntu 24.04+ (noble) kernel 6.8+</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">Ubuntu 22.04+</td><td className="px-3 py-2"><Badge variant="success" className="text-[10px]">required</Badge></td></tr>
                      <tr><td className="px-3 py-2">Driver + CUDA</td><td className="px-3 py-2">580.65+ + CUDA 13.3</td><td className="px-3 py-2">✅ native sm_120</td><td className="px-3 py-2">570+ (13.2) PTX JIT</td><td className="px-3 py-2"><Badge variant="success" className="text-[10px]">native</Badge></td></tr>
                      <tr><td className="px-3 py-2">Driver fallback</td><td className="px-3 py-2">570.86+ + CUDA 13.2</td><td className="px-3 py-2">⚠️ via PTX JIT</td><td className="px-3 py-2">PTX forward compat</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">fallback</Badge></td></tr>
                      <tr><td className="px-3 py-2">Legacy</td><td className="px-3 py-2">550.90+ + CUDA 12.4</td><td className="px-3 py-2">⚠️ legacy JIT</td><td className="px-3 py-2">no Blackwell nat.</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">legacy</Badge></td></tr>
                      <tr><td className="px-3 py-2">Docker</td><td className="px-3 py-2">24+ + compose plugin</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">—</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">required</Badge></td></tr>
                      <tr><td className="px-3 py-2">nvidia-ctk</td><td className="px-3 py-2">nvidia-container-toolkit</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">install auto via install.sh</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">auto</Badge></td></tr>
                      <tr><td className="px-3 py-2">Tailscale</td><td className="px-3 py-2">1.82+</td><td className="px-3 py-2">✅</td><td className="px-3 py-2">tailnet.seedinfer.com</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">auto</Badge></td></tr>
                      <tr><td className="px-3 py-2">vLLM</td><td className="px-3 py-2">nightly cu12 (PTX JIT)</td><td className="px-3 py-2">✅ <code>pip install --pre vllm --extra-index-url https://wheels.vllm.ai/nightly</code></td><td className="px-3 py-2">native cu13 when avail.</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">nightly</Badge></td></tr>
                      <tr><td className="px-3 py-2">Disk</td><td className="px-3 py-2">50GB HF cache + 28GB vLLM</td><td className="px-3 py-2">60GB+ free (df -h)</td><td className="px-3 py-2"><code>df -h</code></td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">50GB+</Badge></td></tr>
                      <tr><td className="px-3 py-2">Ports</td><td className="px-3 py-2">47900:8000 (vLLM) + 47901:3001 (agent)</td><td className="px-3 py-2">host mapping, <code>VLLM_PORT/AGENT_PORT</code> override</td><td className="px-3 py-2">41000+ if busy</td><td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">47900/47901</Badge></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 font-mono text-[11px] leading-4 text-text-secondary">
                  <strong className="text-text-primary">CUDA PTX JIT:</strong> vLLM nightly cu12 wheels run on CUDA 13.3 via forward-compat (driver 580+). No rebuild required. Blackwall sm_120 native PTX only on 580+. Check: <code className="rounded bg-bg-tertiary px-1">nvidia-smi | grep Driver</code> + <code className="rounded bg-bg-tertiary px-1">nvidia-smi --query-gpu=compute_cap --format=csv</code> (12.0 dla 5090). With driver &lt;580: warn, &lt;570: warn, &lt;550: error in install.sh/entrypoint.sh.
                </div>
              </CardContent>
            </Card>

            {/* Install */}
            <Card id="install" className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]"><Terminal className="h-4 w-4 text-accent-brand" /> Instalacja — one-liner vs manual</CardTitle>
                <p className="font-mono text-xs text-text-tertiary">Terminal command that sets up the environment + verification. Copy and paste on Linux.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <CodeBlock label="★ Recommended — one command (auto-authkey + prebuild)" code={ONE_LINER_RECOMMENDED} />
                    <div className="rounded-lg border border-accent-brand/20 bg-accent-brand/10 p-3 font-mono text-[11px] leading-3 text-text-secondary">
                      No parameters — <code className="rounded bg-bg-tertiary px-1">install.sh</code> automatically fetches an authkey from <code className="rounded bg-bg-tertiary px-1">/api/v1/auth/request</code> + prebuild{" "}
                      <code className="rounded bg-bg-tertiary px-1">ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> ||{" "}
                      <code className="rounded bg-bg-tertiary px-1">https://seedinfer.com/provider-image.tar.gz</code> (Pi) || build. Pi nie buduje CUDA — tylko hostuje.
                    </div>
                    <details className="rounded-xl border border-border-dim bg-bg-primary">
                      <summary className="cursor-pointer list-none px-3 py-2 font-mono text-xs font-medium text-text-primary">Advanced — custom authkey / model / gateway (expand)</summary>
                      <div className="space-y-2 border-t border-border-dim p-3">
                        <CodeBlock label="1 · Z kluczem z Generate invite" code={ONE_LINER_SIMPLE} />
                        <CodeBlock label="2 · Auto-fetch key (jq)" code={ONE_LINER_AUTO} />
                        <CodeBlock label="3 · Full options + hostname" code={ONE_LINER_CUSTOM} />
                        <div className="font-mono text-[11px] text-text-tertiary">
                          ENV: <code className="rounded bg-bg-tertiary px-1">SEEDINFER_PREBUILD_IMAGE</code> <code className="rounded bg-bg-tertiary px-1">SEEDINFER_PREBUILD_URL</code> <code className="rounded bg-bg-tertiary px-1">SEEDINFER_SKIP_PREBUILD=1</code>
                        </div>
                      </div>
                    </details>
                    <div className="rounded-lg border border-dashed border-border-default bg-bg-primary p-3 font-mono text-[11px] text-text-secondary">
                      Key <code className="rounded bg-bg-tertiary px-1">YOUR_AUTHKEY</code> → generate at <Link href="/provider" className="text-accent-brand underline">/provider → Generate invite</Link> (valid 24h, tag:provider) — now optional, <code>install.sh</code> auto-fetches if missing. Details at <Link href="/provider" className="text-accent-brand underline">/provider</Link>.
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                      <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1"><Clock className="h-3 w-3" /> Steps — what install.sh does</div>
                      <ol className="mt-2 list-decimal list-inside space-y-1 font-mono text-xs text-text-secondary">
                        <li><code className="rounded bg-bg-tertiary px-1">nvidia-smi</code> check — VRAM ≥32GB, driver 580+, ports 47900/47901 free; auto-fetch authkey from <code className="rounded bg-bg-tertiary px-1">/api/v1/auth/request</code> if --authkey is missing</li>
                        <li>Installs <code>docker 24+ + nvidia-ctk + tailscale</code> if missing</li>
                        <li><span className="inline-flex items-center rounded bg-accent-green/10 px-1 py-0.5 text-[10px] font-medium text-accent-green">Domyślnie: kontener</span> — jeśli host już w <code className="rounded bg-bg-tertiary px-1">tailscale.com</code> (100.94.x.x) → <code className="rounded bg-bg-tertiary px-1">docker run -d --name tailscale-seedinfer --restart unless-stopped --cap-add=NET_ADMIN --cap-add=NET_RAW --device /dev/net/tun -v tailscale-seedinfer-state:/tailscale -e TS_AUTHKEY -e TS_HOSTNAME -e TS_LOGIN_SERVER -e TS_EXTRA_ARGS="--advertise-tags=tag:provider --accept-routes" tailscale/tailscale:latest</code> (healthcheck, volume, network <code>seedinfer-tailnet</code>). Współistnienie <code>100.94.x.x</code> (host, tailscale.com) + <code>100.64.x.x</code> (kontener, Headscale) — nie rozłącza. Provider agent używa kontenera (DNS <code>100.64.x.x</code>). Opt-in host: <code>--force-host-tailscale</code> (<code>--reset</code>, rozłączy tailscale.com) lub <code>TAILSCALE_USE_CONTAINER=0</code>. Jeśli brak istniejącego tailnetu → host <code>tailscale up --login-server https://tailnet.seedinfer.com --authkey XXX --advertise-tags tag:provider</code></li>
                        <li>Clones <code>provider/</code> → <code>/opt/seedinfer-provider</code>, creates <code>.env</code> (<code>VLLM_MODEL=nvidia/...NVFP4</code>)</li>
                        <li>Prebuild: <code>docker pull ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> → <code>curl https://seedinfer.com/provider-image.tar.gz | docker load</code> (Pi) → <code>docker compose up -d --build</code> (fallback) → vLLM auto-download ~30GB → <code>./models/cache</code>. Sidecar compose: <code>docker compose --profile tailscale up -d</code> (<code>tailscale</code> service, volume <code>tailscale-seedinfer-state</code>)</li>
                        <li>Heartbeat every 30s to <code>/api/v1/providers/heartbeat</code> → pending → verifying → verified</li>
                      </ol>
                    </div>
                    <Card className="border border-border-dim bg-bg-primary">
                      <CardHeader className="pb-2"><CardTitle className="text-xs font-mono uppercase tracking-wide text-text-tertiary flex items-center gap-2"><Download className="h-3.5 w-3.5" /> Manual (dev)</CardTitle></CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">{`git clone https://github.com/seedinfer/seedinfer.com.git
cd seedinfer.com
cp provider/.env.example provider/.env
# edytuj TAILSCALE_AUTHKEY, MODEL, SEEDINFER_GATEWAY_URL
docker compose -f provider/docker-compose.yml up -d --build
docker logs -f seedinfer-provider | grep -i download
du -sh ./models/cache
curl -fsS http://127.0.0.1:47901/health | jq`}</pre>
                        <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">{`# Tailscale — domyślnie kontener (nie rusza hosta, współistnienie 100.94.x.x + 100.64.x.x):
docker exec tailscale-seedinfer tailscale status  # kontener 100.64.x.x (Headscale)
tailscale status  # host 100.94.x.x (dom, tailscale.com — nienaruszony)
docker exec tailscale-seedinfer tailscale ip -4  # 100.64.x.x
tailscale ip -4  # host 100.94.x.x
ping -c2 gateway.seedinfer.ts.net
# Sidecar compose: docker compose --profile tailscale up -d
# volume: tailscale-seedinfer-state:/tailscale  network: seedinfer-tailnet
# healthcheck: tailscale status  cap_add: [NET_ADMIN, NET_RAW]  device: /dev/net/tun
# TS_EXTRA_ARGS="--advertise-tags=tag:provider --accept-routes"  TS_LOGIN_SERVER=https://tailnet.seedinfer.com
# Opt-in host (rozłączy tailscale.com): curl ... | bash -s -- --force-host-tailscale`}</pre>
                      </CardContent>
                    </Card>
                    <div className="flex flex-wrap gap-2 font-mono text-xs">
                      <a href="/install.sh" className="inline-flex items-center gap-1 text-accent-brand hover:underline"><FileText className="h-3.5 w-3.5" /> /install.sh</a>
                      <span className="text-text-tertiary">·</span>
                      <a href="/provider.tar.gz" className="text-text-tertiary hover:text-text-primary">/provider.tar.gz</a>
                      <span className="text-text-tertiary">·</span>
                      <a href="/api/v1/auth/request" className="text-text-tertiary hover:text-text-primary">/api/v1/auth/request</a>
                      <span className="text-text-tertiary">·</span>
                      <Link href="/providers" className="text-accent-brand hover:underline">/providers → fleet</Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verify */}
            <Card id="verify" className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-[13px]"><ShieldCheck className="h-4 w-4 text-accent-green" /> Verification — health, models, fleet</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Lokalnie — vLLM + agent</div>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">{`curl -fsS http://127.0.0.1:47901/health | jq
# {"status":"ok","provider_id":"...","vllm_health":{"status":"ok"},"gpu":{"count":1}}
curl -fsS http://127.0.0.1:47900/v1/models | jq
curl http://127.0.0.1:47901/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"Hello"}],"max_tokens":32}'`}</pre>
                    <div className="mt-1 font-mono text-[11px] text-text-tertiary">Host ports: <code className="rounded bg-bg-tertiary px-1">47900:8000</code> vLLM, <code className="rounded bg-bg-tertiary px-1">47901:3001</code> agent. Env override: <code>VLLM_PORT=41000 AGENT_PORT=41001</code>.</div>
                  </div>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Gateway — heartbeat + verify</div>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">{`# heartbeat co 30s (agent/main.py)
POST https://seedinfer.com/api/v1/providers/heartbeat
# auto-verify po 2 heartbeat (~60s)
GET https://seedinfer.com/api/v1/providers | jq
# verification: pending -> verifying -> verified
# manual verify:
curl -X POST https://seedinfer.com/api/v1/providers/verify \\
  -H "Content-Type: application/json" \\
  -d '{"provider_id":"provider-5090-xxx"}' | jq`}</pre>
                  </div>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Fleet UI + API</div>
                    <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                      <code className="rounded bg-bg-tertiary px-1">/providers</code> — pending/verifying opacity 60, verified 🟢 opacity 100 (official node).<br />
                      <code className="rounded bg-bg-tertiary px-1">GET /api/v1/providers?verified=1</code> — tylko verified.<br />
                      Pi gateway decyduje <code>verified</code> (nie Headscale ACL).
                    </div>
                    <div className="mt-2 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-tertiary">Endpoints: <Link href="/api/v1/providers" className="text-accent-brand underline">/api/v1/providers</Link> · <Link href="/api/v1/models" className="text-accent-brand underline">/api/v1/models</Link> · <Link href="/api/v1/pricing" className="text-accent-brand underline">/api/v1/pricing</Link></div>
                  </div>
                </div>
                <div className="rounded-lg border border-border-dim bg-bg-primary p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Pi gateway — Headscale & telemetry</div>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">{`# Control plane: tailnet.seedinfer.com (Headscale)
# Authkey: curl -fsSL https://seedinfer.com/api/v1/auth/request | jq
# Docs: https://seedinfer.com/docs
curl -fsS https://seedinfer.com/api/v1/providers | jq '.data[] | {id,status,verification}'
tailscale status  # na providerze
docker logs -f seedinfer-provider | grep -E "heartbeat|vllm|download"`}</pre>
                </div>
              </CardContent>
            </Card>

            {/* Troubleshooting */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-[13px]"><Wrench className="h-4 w-4 text-accent-brand" /> Troubleshooting</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr><th className="px-3 py-2">Symptom</th><th className="px-3 py-2">Cause</th><th className="px-3 py-2">Fix</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr><td className="px-3 py-2 font-medium text-text-primary">OOM CUDA</td><td className="px-3 py-2">1M ctx + 0.93 on 24GB, full KV</td><td className="px-3 py-2"><code className="rounded bg-bg-tertiary px-1">VLLM_MAX_MODEL_LEN=32768</code> + <code className="rounded bg-bg-tertiary px-1">VLLM_GPU_MEMORY_UTILIZATION=0.80</code> → restart</td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary"><code>nvidia-smi</code> brak</td><td className="px-3 py-2">driver &lt;580, missing module</td><td className="px-3 py-2"><code>sudo apt update && sudo apt install nvidia-driver-580 && sudo reboot</code> · fallback 570 / 550 legacy · <code>ubuntu-drivers autoinstall</code></td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">docker no nvidia runtime</td><td className="px-3 py-2">missing nvidia-ctk</td><td className="px-3 py-2"><code>sudo apt install nvidia-container-toolkit && sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker</code></td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">port 47900/47901 in use</td><td className="px-3 py-2"><code>ss -tlnp | grep :4790</code></td><td className="px-3 py-2"><code>VLLM_PORT=41000 AGENT_PORT=41001 curl ... | bash -s -- --authkey XXX</code> (zakres 479xx wolny, lub 41000+)</td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">disk full / no space</td><td className="px-3 py-2">HF cache 60GB + vLLM 28GB</td><td className="px-3 py-2"><code>df -h</code> · <code>docker system prune -a</code> · <code>rm -rf ./models/cache/.../snapshots</code> · check 60GB+ free</td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">vLLM down in /health</td><td className="px-3 py-2">HF model missing, QUANTIZATION mismatch</td><td className="px-3 py-2"><code>docker logs seedinfer-provider --tail 100</code> · <code>VLLM_QUANTIZATION=modelopt</code> (nie modelopt_fp4) + <code>--kv-cache-dtype fp8</code> auto</td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">tailscale invalid authkey</td><td className="px-3 py-2">key expired (24h)</td><td className="px-3 py-2">New key: <code>curl -fsSL https://seedinfer.com/api/v1/auth/request | jq</code> + <code>docker exec tailscale-seedinfer tailscale up --authkey NEW</code> (kontener) lub <code>tailscale up --authkey NEW</code> (host) — details <a href="/docs" className="text-accent-brand underline">/docs</a></td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">host już w tailscale.com 100.94.x.x</td><td className="px-3 py-2">domowy tailnet, nie chcesz rozłączać</td><td className="px-3 py-2"><span className="inline-flex items-center rounded bg-accent-green/10 px-1 py-0.5 text-[10px] font-medium text-accent-green">Domyślnie: kontener</span> — <code>install.sh</code> auto <code>docker run -d --name tailscale-seedinfer --restart unless-stopped --cap-add=NET_ADMIN --cap-add=NET_RAW --device /dev/net/tun -v tailscale-seedinfer-state:/tailscale -e TS_AUTHKEY -e TS_HOSTNAME -e TS_LOGIN_SERVER -e TS_EXTRA_ARGS="--advertise-tags=tag:provider --accept-routes" tailscale/tailscale:latest</code> (healthcheck, volume, network). Współistnienie <code>100.94.x.x</code> (host) + <code>100.64.x.x</code> (kontener) — nie rozłącza. Provider używa kontenera (<code>docker exec tailscale-seedinfer tailscale status</code>). Compose: <code>docker compose --profile tailscale up -d</code>. Opt-in host: <code>--force-host-tailscale</code> (<code>--reset</code>, rozłączy) lub <code>TAILSCALE_USE_CONTAINER=0</code></td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">tailscale-seedinfer nie startuje</td><td className="px-3 py-2">volume/network/authkey</td><td className="px-3 py-2"><code>docker logs tailscale-seedinfer</code> · <code>docker volume create tailscale-seedinfer-state</code> · <code>docker network create seedinfer-tailnet</code> · check <code>TS_AUTHKEY</code>/<code>TS_LOGIN_SERVER</code> · healthcheck <code>tailscale status</code></td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">heartbeat 401/404</td><td className="px-3 py-2">gateway path fallback</td><td className="px-3 py-2">Agent fallback na <code>/api/providers/heartbeat</code> — log warn, nie krytyczne · check <code>SEEDINFER_GATEWAY_URL</code></td></tr>
                      <tr><td className="px-3 py-2 font-medium text-text-primary">chat_template error</td><td className="px-3 py-2">jinja missing</td><td className="px-3 py-2">HF <code>tokenizer_config.json</code> jinja auto z nvidia — nie nadpisuj · fallback <code>./provider/assets:/qwen_setup:ro</code> · <code>VLLM_CHAT_TEMPLATE=/qwen_setup/...</code></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-dashed border-border-default bg-bg-primary p-3 font-mono text-[11px] leading-4 text-text-secondary">
                  Logi: <code className="rounded bg-bg-tertiary px-1">docker compose -f provider/docker-compose.yml logs -f</code> · <code className="rounded bg-bg-tertiary px-1">docker exec tailscale-seedinfer tailscale status</code> (kontener 100.64.x.x) · <code className="rounded bg-bg-tertiary px-1">tailscale status</code> (host 100.94.x.x — nienaruszony) · <code className="rounded bg-bg-tertiary px-1">docker logs tailscale-seedinfer</code> · <code className="rounded bg-bg-tertiary px-1">curl -fsS http://127.0.0.1:47901/metrics | jq</code> · <code className="rounded bg-bg-tertiary px-1">nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv</code> · <code className="rounded bg-bg-tertiary px-1">df -h && du -sh ./models/cache</code>
                </div>
              </CardContent>
            </Card>

            {/* Files & Endpoints */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-[13px]"><FileText className="h-4 w-4 text-accent-brand" /> Pliki, env, endpoints</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <a href="/provider.tar.gz" className="rounded-xl border border-accent-brand/20 bg-accent-brand/10 p-4 hover:bg-accent-brand/15">
                    <div className="flex items-center gap-2 font-medium text-text-primary"><Download className="h-4 w-4" /> provider.tar.gz</div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">Full provider/ pack — Dockerfile.cuda + compose + agent</div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">https://seedinfer.com/provider.tar.gz →</div>
                  </a>
                  <a href="/install.sh" className="rounded-xl border border-border-dim bg-bg-primary p-4 hover:bg-bg-tertiary">
                    <div className="flex items-center gap-2 font-medium text-text-primary"><FileText className="h-4 w-4" /> install.sh</div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">One-liner plug-and-play ~279 linii · NVFP4</div>
                    <div className="mt-2 font-mono text-[11px] text-text-tertiary">https://seedinfer.com/install.sh</div>
                  </a>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="flex items-center gap-2 font-medium text-text-primary"><Server className="h-4 w-4" /> Control plane</div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">Headscale tailnet.seedinfer.com (WireGuard) · Gateway https://seedinfer.com</div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">docs.seedinfer.com /docs →</div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr><th className="px-3 py-2">ENV</th><th className="px-3 py-2">Default</th><th className="px-3 py-2">Opis (host 1:1 RTX 5090 GB202)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr><td className="px-3 py-2">VLLM_MODEL</td><td className="px-3 py-2">nvidia/...NVFP4</td><td className="px-3 py-2">HF repo NVFP4 (plug-and-play auto-download)</td></tr>
                      <tr><td className="px-3 py-2">MODEL</td><td className="px-3 py-2">seedinfer/nemotron-lightning-1m</td><td className="px-3 py-2">logiczny alias via <code>--served-model-name</code></td></tr>
                      <tr><td className="px-3 py-2">VLLM_QUANTIZATION</td><td className="px-3 py-2">modelopt</td><td className="px-3 py-2">compressed-tensors ModelOpt NVFP4 (nie modelopt_fp4/auto)</td></tr>
                      <tr><td className="px-3 py-2">VLLM_KV_CACHE_DTYPE</td><td className="px-3 py-2">fp8</td><td className="px-3 py-2">FP8 KV (nie auto)</td></tr>
                      <tr><td className="px-3 py-2">VLLM_MOE_BACKEND</td><td className="px-3 py-2">marlin</td><td className="px-3 py-2">Blackwell FP4 native · A100/H100 → humming</td></tr>
                      <tr><td className="px-3 py-2">VLLM_MAMBA_BACKEND</td><td className="px-3 py-2">flashinfer</td><td className="px-3 py-2">host 1:1</td></tr>
                      <tr><td className="px-3 py-2">VLLM_ATTENTION_BACKEND</td><td className="px-3 py-2">FLASHINFER</td><td className="px-3 py-2">host 1:1</td></tr>
                      <tr><td className="px-3 py-2">VLLM_GPU_MEMORY_UTILIZATION</td><td className="px-3 py-2">0.93</td><td className="px-3 py-2">host 1:1 dla 32GB (nie 0.90)</td></tr>
                      <tr><td className="px-3 py-2">VLLM_MAX_MODEL_LEN</td><td className="px-3 py-2">1048576</td><td className="px-3 py-2">1M ctx (2M KV)</td></tr>
                      <tr><td className="px-3 py-2">VLLM_PORT / AGENT_PORT</td><td className="px-3 py-2">47900 / 47901</td><td className="px-3 py-2">host→container 8000/3001, env override</td></tr>
                      <tr><td className="px-3 py-2">TAILSCALE_* </td><td className="px-3 py-2">tailnet.seedinfer.com</td><td className="px-3 py-2">Headscale login-server + tag:provider</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2 font-mono text-xs">
                  <Link href="/api/v1/models" className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary">/api/v1/models</Link>
                  <Link href="/api/v1/pricing" className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary">/api/v1/pricing</Link>
                  <Link href="/api/v1/providers" className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary">/api/v1/providers</Link>
                  <Link href="/api/v1/telemetry" className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary">/api/v1/telemetry</Link>
                  <a href="/install.sh" className="rounded bg-accent-brand px-2 py-1 text-white hover:bg-accent-brand-hover">/install.sh</a>
                  <a href="/provider.tar.gz" className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary">/provider.tar.gz</a>
                </div>
              </CardContent>
            </Card>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Docs · Faza 0 CUDA — <Link href="/install.sh" className="text-accent-brand hover:underline">/install.sh</Link> · <Link href="/provider.tar.gz" className="text-accent-brand hover:underline">/provider.tar.gz</Link> · <Link href="/api/v1/auth/request" className="text-accent-brand hover:underline">/api/v1/auth/request</Link> · <Link href="/api/v1/providers" className="text-accent-brand hover:underline">/api/v1/providers</Link> · <Link href="/providers" className="text-accent-brand hover:underline">/providers</Link> · <Link href="/provider" className="text-accent-brand hover:underline">/provider</Link> · <a href="/docs" className="text-accent-brand underline">docs.seedinfer.com /docs</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

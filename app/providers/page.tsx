"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import Sidebar from "@/components/sidebar"
import ProviderFleet from "@/components/provider-fleet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Server, Terminal, RefreshCw, Cpu, HardDrive, Zap, FileText, ChevronDown, Activity, KeyRound, ExternalLink, ShieldCheck } from "lucide-react"
import { fetchStats, fetchGatewayProviders } from "@/lib/api"
import type { StatsResponse } from "@/lib/types"
import type { GatewayProvider } from "@/lib/api"

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
      title={label || "Copy"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label || "Copy"}
    </button>
  )
}

export default function ProvidersPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [gateway, setGateway] = useState<GatewayProvider[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<string>("")

  const load = async (force = false) => {
    try {
      setError(null)
      if (!stats && !gateway) setLoading(true)
      const [gw, data] = await Promise.allSettled([
        fetchGatewayProviders(force),
        fetchStats(force),
      ])
      if (gw.status === "fulfilled") setGateway(gw.value)
      else setGateway([])
      if (data.status === "fulfilled") setStats(data.value as StatsResponse)
      else if (gw.status === "rejected") setError((data as PromiseRejectedResult).reason?.message ?? "Failed to load")
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 15000)
    return () => clearInterval(id)
  }, [])

  const verifiedCount = gateway?.filter((g) => (g as any).verification?.status === "verified").length ?? 0

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">SeedInfer Providers · Become a node</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              Gateway fleet <code className="rounded bg-bg-tertiary px-1">/api/v1/providers</code> · NVFP4 1M ctx $0.02/$0.05 · CUDA 13.3 · 47900/47901 · {gateway?.length ?? 0} nodes · last fetch {lastFetch || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/docs"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <FileText className="h-3.5 w-3.5" /> Docs
            </Link>
            <Link
              href="/provider"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-brand-hover"
            >
              <Server className="h-3.5 w-3.5" /> Become a Provider →
            </Link>
            <button
              onClick={() => load(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
            {/* One-liner + Requirements — primary CTA */}
            <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> NVFP4 · 1M ctx
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">seedinfer/nemotron-lightning-1m</Badge>
                  <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">$0.02 / $0.05 per 1M</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">CUDA 13.3 · driver 580+</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">47900:8000 + 47901:3001</Badge>
                  <span className="ml-auto flex items-center gap-2">
                    <Link href="/docs" className="inline-flex items-center gap-1 font-mono text-xs text-accent-brand hover:underline">
                      Docs / hardware <ExternalLink className="h-3 w-3" />
                    </Link>
                    <span className="font-mono text-[11px] text-text-tertiary">·</span>
                    <Link href="/provider#install" className="inline-flex items-center gap-1 font-mono text-xs text-text-secondary hover:text-text-primary">
                      Full guide on /provider →
                    </Link>
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold tracking-tight text-text-primary flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-accent-brand" /> One-liner — terminal Linux (plug-and-play)
                  <Badge variant="outline" className="ml-2 font-mono text-[10px]">curl | bash</Badge>
                </h2>
                <p className="mt-1 font-mono text-xs leading-4 text-text-tertiary">
                  Runs: <code className="rounded bg-bg-tertiary px-1">nvidia-smi</code> check (VRAM 32GB min, 16GB hard min, ports 47900/47901 free → env <code className="rounded bg-bg-tertiary px-1">VLLM_PORT/AGENT_PORT</code>) → Docker + <code className="rounded bg-bg-tertiary px-1">nvidia-ctk</code> + <code className="rounded bg-bg-tertiary px-1">tailscale</code> →{" "}
                  <code className="rounded bg-bg-tertiary px-1">tailscale up --login-server https://tailnet.seedinfer.com --authkey XXX --advertise-tags tag:provider</code> →{" "}
                  <code className="rounded bg-bg-tertiary px-1">docker compose up -d --build</code> (host 47900:8000, 47901:3001) → heartbeat every 30s → verified fleet.
                </p>

                <div className="mt-4 grid gap-6 lg:grid-cols-[1.65fr_1fr]">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">1 · Simple (recommended)</span>
                        <CopyButton text={ONE_LINER_SIMPLE} />
                      </div>
                      <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-xs leading-4 text-text-primary">{ONE_LINER_SIMPLE}</pre>
                      <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                        Replace <code className="rounded bg-bg-tertiary px-1">YOUR_AUTHKEY</code> with a key from{" "}
                        <code className="rounded bg-bg-tertiary px-1">/api/v1/auth/request</code> or the Generate button on{" "}
                        <Link href="/provider" className="text-accent-brand underline">/provider</Link>. Gateway: <code className="rounded bg-bg-tertiary px-1">https://seedinfer.com</code>.
                      </p>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">2 · Auto-fetch key (jq)</span>
                        <CopyButton text={ONE_LINER_AUTO} />
                      </div>
                      <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-xs leading-4 text-text-secondary">{ONE_LINER_AUTO}</pre>
                      <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                        For scripts — fetches authkey from <code className="rounded bg-bg-tertiary px-1">/api/v1/auth/request</code> and installs immediately. Requires <code className="rounded bg-bg-tertiary px-1">jq</code>.
                      </p>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">3 · Full options + hostname</span>
                        <CopyButton text={ONE_LINER_CUSTOM} />
                      </div>
                      <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-xs leading-4 text-text-secondary">{ONE_LINER_CUSTOM}</pre>
                    </div>
                    <div className="flex flex-wrap gap-2 font-mono text-xs">
                      <a href="/install.sh" className="inline-flex items-center gap-1 text-accent-brand hover:underline">
                        <FileText className="h-3.5 w-3.5" /> /install.sh
                      </a>
                      <span className="text-text-tertiary">·</span>
                      <a href="/api/install" className="text-text-tertiary hover:text-text-primary">/api/install</a>
                      <span className="text-text-tertiary">·</span>
                      <a href="/api/v1/auth/request" className="text-text-tertiary hover:text-text-primary">/api/v1/auth/request</a>
                      <span className="text-text-tertiary">·</span>
                      <Link href="/docs" className="text-accent-brand hover:underline">/docs → hardware</Link>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Card className="border border-border-dim bg-bg-primary/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                          <ShieldCheck className="h-3.5 w-3.5" /> Quick requirements
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5 pt-0 font-mono text-xs">
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Model</span>
                          <span className="font-medium text-text-primary">NVFP4 · 1M ctx $0.02/$0.05</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">GPU min</span>
                          <span className="font-medium text-accent-brand">RTX 5090 32GB GB202</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">VRAM math</span>
                          <span className="font-medium text-text-primary">16-22 +6 KV =22-28GB</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">OS</span>
                          <span className="font-medium text-text-primary">Ubuntu 24.04 noble</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Driver / CUDA</span>
                          <span className="font-medium text-text-primary">580.65+ / 13.3</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Docker</span>
                          <span className="font-medium text-text-primary">24+ + nvidia-ctk</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">HF cache</span>
                          <span className="font-medium text-text-primary">50GB+ (~60GB total)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Free space</span>
                          <span className="font-medium text-text-primary">60GB+ free (df -h)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Ports</span>
                          <span className="font-medium text-text-primary">47900:8000 + 47901:3001</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Net</span>
                          <span className="font-medium text-text-primary">UDP 41641</span>
                        </div>
                        <div className="rounded-lg border border-dashed border-border-default bg-bg-secondary p-2.5 font-mono text-[11px] leading-3 text-text-secondary">
                          <strong className="text-text-primary">Flags host 1:1:</strong> marlin + flashinfer + fp8 · 0.93 · 1048576 · 128 · 4096 · <code className="rounded bg-bg-tertiary px-1">VLLM_ATTENTION_BACKEND=FLASHINFER</code> +{" "}
                          <code className="rounded bg-bg-tertiary px-1">tailscale</code> auto.
                        </div>
                        <Link
                          href="/docs"
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-accent-brand/20 bg-accent-brand/10 px-3 py-2 text-xs font-medium text-accent-brand hover:bg-accent-brand/15"
                        >
                          <FileText className="h-3.5 w-3.5" /> Full hardware docs → /docs
                        </Link>
                      </CardContent>
                    </Card>
                    <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                      <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Verify after install</div>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">{`curl -fsS http://127.0.0.1:47901/health | jq
curl -fsS http://127.0.0.1:47900/v1/models | jq
curl http://127.0.0.1:47901/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"ping"}],"max_tokens":32}'`}</pre>
                      <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                        Fleet: <code className="rounded bg-bg-tertiary px-1">GET /api/v1/providers</code> · heartbeat co 30s · auto-verify po 2 heartbeat.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
                {error} — upstream unavailable.
              </div>
            )}
            {loading && !stats && !gateway && !error && (
              <div className="rounded-xl border border-border-dim bg-bg-secondary px-4 py-3 text-sm text-text-tertiary">
                Loading providers from <code className="rounded bg-bg-tertiary px-1">/api/v1/providers</code> +{" "}
                <code className="rounded bg-bg-tertiary px-1">/api/stats</code> …
              </div>
            )}
            {!loading && !stats && !gateway && error && (
              <div className="rounded-xl border border-border-dim bg-bg-secondary px-4 py-6 text-center text-sm text-text-tertiary">
                No data — upstream unavailable (502).
              </div>
            )}

            {/* SeedInfer gateway fleet — PRIMARY */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Server className="h-4 w-4 text-accent-brand" /> SeedInfer gateway fleet —{" "}
                  <code className="rounded bg-bg-tertiary px-1 text-xs font-mono">/api/v1/providers</code>
                  <span className="font-normal text-text-tertiary">· primary</span>
                </h3>
                <Badge variant={verifiedCount > 0 ? "success" : "outline"} className="font-mono text-[10px]">
                  {verifiedCount} verified · {gateway?.length ?? 0} total
                </Badge>
                <span className="font-mono text-[11px] text-text-tertiary hidden sm:inline">
                  pending/verifying opacity 60 · verified = official node ·{" "}
                  <code className="rounded bg-bg-tertiary px-1">heartbeat 30s</code>
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Link href="/provider" className="inline-flex items-center gap-1 font-mono text-xs text-accent-brand hover:underline">
                    Add your node → <KeyRound className="h-3 w-3" />
                  </Link>
                  <span className="font-mono text-xs text-text-tertiary">·</span>
                  <a href="/api/v1/providers" target="_blank" className="inline-flex items-center gap-1 font-mono text-xs text-text-tertiary hover:text-text-primary">
                    JSON <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              {gateway && gateway.length === 0 ? (
                <Card className="border border-border-dim bg-bg-secondary p-6 text-center">
                  <div className="text-sm font-medium text-text-primary">No providers in gateway — awaiting heartbeat</div>
                  <div className="mt-1 font-mono text-xs text-text-tertiary">
                    Provider runs: <code className="rounded bg-bg-tertiary px-1">curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey XXX</code> → heartbeat every 30s → auto-verify after 2 heartbeats (~60s) → verified (green).
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Link href="/provider" className="inline-flex items-center gap-2 rounded-xl bg-accent-brand px-4 py-2 text-sm font-medium text-white hover:bg-accent-brand-hover">
                      <Terminal className="h-4 w-4" /> Become a Provider
                    </Link>
                    <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover">
                      <FileText className="h-4 w-4" /> Docs / hardware
                    </Link>
                  </div>
                </Card>
              ) : (
                <ProviderFleet providers={(gateway as any) ?? []} />
              )}
              <div className="rounded-lg border border-dashed border-border-default bg-bg-secondary p-2.5 font-mono text-[11px] text-text-tertiary">
                Fleet page <code className="rounded bg-bg-tertiary px-1">/api/v1/providers</code> returns <code>verification.status</code> +{" "}
                <code>heartbeat_count</code> + <code>tailscale_ip</code>. UI: <code>pending</code>🟡 / <code>verifying</code>🔵 opacity 60, <code>verified</code>🟢 opacity 100 (official), <code>failed</code>🔴. Manual:{" "}
                <code className="rounded bg-bg-tertiary px-1">curl -X POST https://seedinfer.com/api/v1/providers/verify -H &apos;Content-Type: application/json&apos; -d &apos;&#123;&quot;provider_id&quot;:&quot;xxx&quot;&#125;&apos;</code>
              </div>
            </div>

            {/* Upstream fleet — SECONDARY collapsed */}
            <details className="group rounded-xl border border-border-dim bg-bg-secondary">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-semibold text-text-primary">
                <span className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-text-tertiary" /> Upstream fleet —{" "}
                  <code className="rounded bg-bg-tertiary px-1 font-mono text-[11px]">/api/stats</code>{" "}
                  <span className="font-normal text-text-tertiary">(secondary, reference only)</span>
                  <Badge variant="outline" className="ml-1 font-mono text-[10px]">{stats?.providers?.length ?? 0} providers</Badge>
                  <Badge variant="outline" className="ml-1 font-mono text-[10px]">{stats?.active_providers ?? "—"} active</Badge>
                </span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-text-tertiary">
                  <span className="hidden sm:inline">proxies /api/stats</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="border-t border-border-dim p-4 space-y-3">
                <div className="rounded-lg border border-accent-amber/20 bg-accent-amber/10 p-3 font-mono text-[11px] leading-4 text-text-secondary">
                  <strong className="text-text-primary">SeedInfer Network Reference</strong> — data from <code className="rounded bg-bg-tertiary px-1">/api/stats</code>. SeedInfer gateway fleet (<code className="rounded bg-bg-tertiary px-1">/api/v1/providers</code>) is the source of truth — nodes with heartbeat + verification. Network stats serve only as a comparison.{" "}
                  <Link href="/docs" className="text-accent-brand underline">See /docs</Link> and{" "}
                  <Link href="/stats" className="text-accent-brand underline">/stats</Link>.
                </div>
                <ProviderFleet providers={stats?.providers ?? []} />
              </div>
            </details>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary flex flex-wrap gap-2">
              <span>
                SeedInfer.com · Gateway fleet <code className="rounded bg-bg-tertiary px-1">/api/v1/providers</code> (heartbeat + verification) + heartbeat{" "}
                <code className="rounded bg-bg-tertiary px-1">POST /api/v1/providers/heartbeat</code> · One-liner{" "}
                <code className="rounded bg-bg-tertiary px-1">https://seedinfer.com/install.sh</code> · Host 47900:8000 (vLLM) 47901:3001 (agent) ·{" "}
                <Link href="/docs" className="text-accent-brand underline">/docs</Link> ·{" "}
                <Link href="/provider" className="text-accent-brand underline">/provider</Link> · SeedInfer Network Statistics{" "}
                <code className="rounded bg-bg-tertiary px-1">/api/stats</code> (secondary collapsed).
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

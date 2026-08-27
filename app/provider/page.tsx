"use client"
import { useState } from "react"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Server,
  Coins,
  Cpu,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Download,
  KeyRound,
  RefreshCw,
  Activity,
  HardDrive,
  Clock,
  BadgeCheck,
  FileText,
  Zap,
  Globe,
} from "lucide-react"

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
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1.5 font-mono text-[11px] text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      title={label || "Copy"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label || "Copy"}
    </button>
  )
}

export default function ProviderPage() {
  const [authKey, setAuthKey] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authMeta, setAuthMeta] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const generateKey = async () => {
    setAuthLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/v1/auth/request`, { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || j?.hint || "Failed to generate key")
      setAuthKey(j.authkey)
      setAuthMeta(j)
    } catch (e: any) {
      setError(e?.message || "Failed to generate key")
    } finally {
      setAuthLoading(false)
    }
  }

  const oneLinerWithKey = authKey
    ? `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey ${authKey}`
    : ONE_LINER_SIMPLE

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Become a Provider</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              Earn per token · RTX 5090 32GB · NVFP4 · 1M ctx · CUDA 13.3 · Tailnet seedinfer.ts.net
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/v1/providers"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <Activity className="h-3.5 w-3.5" /> /api/v1/providers
            </a>
            <a
              href="/earn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover"
            >
              <Coins className="h-3.5 w-3.5" /> Earnings
            </a>
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
                      <Badge variant="success" className="gap-1">
                        <BadgeCheck className="h-3 w-3" /> Faza 0 · NVFP4
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        seedinfer/nemotron-lightning-1m
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        1M ctx · 2M KV
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                        CUDA 13.3 · driver 580+
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-accent-green/30 text-accent-green">
                        Fair Monthly Waterfall Settlement
                      </Badge>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">
                      Become a Provider — fairest settlement for GPU operators
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-5 text-text-secondary">
                      Serve{" "}
                      <code className="rounded bg-bg-tertiary px-1 font-mono text-xs">seedinfer/nemotron-lightning-1m</code>{" "}
                      (NVIDIA Nemotron 3.5 Lightning 30B A3B NVFP4) on your RTX 5090 32GB (GB202 Blackwell).
                      Fair monthly settlement model: <strong className="text-text-primary">$0.40/day standby coverage</strong> (for ≥50% uptime since joining) to cover electricity + <strong className="text-text-primary">network surplus profit share from processed traffic</strong>. Automated USDC payouts on Base network (min. $1.00 USD / month).
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Clock className="h-3 w-3 text-accent-brand" /> Standby Electricity Cover
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">$0.40 / day</div>
                        <div className="font-mono text-[10px] text-text-tertiary">$0.01667/h (after completed hour, uptime ≥50%)</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Coins className="h-3 w-3 text-accent-green" /> Profit Sharing
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">Proportional Share</div>
                        <div className="font-mono text-[10px] text-text-tertiary">from net revenue based on processed volume and model rates</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Cpu className="h-3 w-3" /> Context & Hardware
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">1M · RTX 5090 32GB</div>
                        <div className="font-mono text-[10px] text-text-tertiary">NVFP4 W4A16+FP8 KV ~22-28GB VRAM</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href="#install"
                        className="inline-flex items-center gap-2 rounded-xl bg-accent-brand px-4 py-2 text-sm font-medium text-white hover:bg-accent-brand-hover"
                      >
                        <Terminal className="h-4 w-4" /> One-liner install
                      </a>
                      <a
                        href="/provider.tar.gz"
                        className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover"
                      >
                        <Download className="h-4 w-4" /> provider.tar.gz
                      </a>
                      <a
                        href="https://seedinfer.com/install.sh"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-text-tertiary hover:text-text-primary"
                      >
                        https://seedinfer.com/install.sh <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <Card className="w-full shrink-0 border border-border-dim bg-bg-primary/60 lg:w-[380px]">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                        <ShieldCheck className="h-3.5 w-3.5" /> Requirements
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">OS</span>
                          <span className="font-medium text-text-primary">Ubuntu 24.04+ (noble)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Driver</span>
                          <span className="font-medium text-text-primary">580+ (CUDA 13.3+)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">GPU</span>
                          <span className="font-medium text-text-primary">RTX 5090 32GB min</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">VRAM min</span>
                          <span className="font-medium text-text-primary">32GB (16 hard min)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Docker</span>
                          <span className="font-medium text-text-primary">24+ + nvidia-ctk</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">HF cache</span>
                          <span className="font-medium text-text-primary">50GB+ (provider ~60GB with model)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Free space</span>
                          <span className="font-medium text-text-primary">60GB+ (df -h)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Network</span>
                          <span className="font-medium text-text-primary">UDP 41641</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                          <span className="text-text-tertiary">Ports</span>
                          <span className="font-medium text-text-primary">47900:8000 + 47901:3001</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border-default bg-bg-secondary p-2.5 font-mono text-[11px] leading-3 text-text-secondary">
                        tailscale + nvidia-container-toolkit are installed automatically by <code className="rounded bg-bg-tertiary px-1">install.sh</code> if missing. Host ports 47900:8000 + 47901:3001 can be overridden via env <code className="rounded bg-bg-tertiary px-1">VLLM_PORT/AGENT_PORT</code>.
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 font-mono text-[11px] leading-3 text-text-secondary">
                        Minimum 60GB free (vLLM ~28.8GB + NVFP4 ~30GB + cache). Check <code className="rounded bg-bg-tertiary px-1">df -h</code> · cleanup: <code className="rounded bg-bg-tertiary px-1">docker system prune -a</code> · free ports 47900/47901 (overridable via env VLLM_PORT/AGENT_PORT) — details in <a href="/docs" className="text-accent-brand underline">/docs</a>.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* One-liner */}
            <Card id="install" className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Terminal className="h-4 w-4 text-accent-brand" /> One-liner — terminal Linux
                  <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                    curl | bash
                  </Badge>
                </CardTitle>
                <p className="font-mono text-xs text-text-tertiary">
                  One command: <code className="rounded bg-bg-tertiary px-1">curl -fsSL https://seedinfer.com/install.sh | bash</code> — auto-fetches authkey from{" "}
                  <code className="rounded bg-bg-tertiary px-1">/api/v1/auth/request</code> if --authkey is missing, nvidia-smi check (47900/47901 free, VLLM_PORT/AGENT_PORT) → Docker + nvidia-ctk + tailscale →{" "}
                  <code className="rounded bg-bg-tertiary px-1">tailscale up</code> → prebuild{" "}
                  <code className="rounded bg-bg-tertiary px-1">docker pull ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> ||{" "}
                  <code className="rounded bg-bg-tertiary px-1">curl https://seedinfer.com/provider-image.tar.gz | docker load</code> (Pi) ||{" "}
                  <code className="rounded bg-bg-tertiary px-1">docker compose up</code> → heartbeat → verified.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Authkey generation */}
                <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-accent-brand" />
                      <span className="text-sm font-medium text-text-primary">Authkey</span>
                      <span className="font-mono text-xs text-text-tertiary">tag:provider · 24h · reusable</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateKey()}
                        disabled={authLoading}
                        className="gap-1.5"
                      >
                        {authLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                        Generate invite
                      </Button>
                    </div>
                  </div>

                  {authKey && (
                    <div className="mt-3 rounded-lg border border-accent-green/20 bg-accent-green/10 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs font-medium text-accent-green">Authkey ready</div>
                          <div className="mt-1 break-all rounded bg-bg-secondary p-2 font-mono text-xs text-text-primary">
                            {authKey}
                          </div>
                          {authMeta && (
                            <div className="mt-1 font-mono text-[11px] text-text-tertiary">
                              {authMeta.expires} · {authMeta.login_server} ·{" "}
                              {authMeta.created_at?.slice(0, 19).replace("T", " ")} · Key valid for 24h, one-time use
                            </div>
                          )}
                        </div>
                        <CopyButton text={authKey} label="Copy key" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href="https://dashboard.seedinfer.com"
                          target="_blank"
                          className="inline-flex items-center gap-1 font-mono text-xs text-accent-brand hover:underline"
                        >
                          dashboard.seedinfer.com <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="font-mono text-xs text-text-tertiary">— contact us for a production key</span>
                      </div>
                    </div>
                  )}
                  {!authKey && (
                    <div className="mt-3 rounded-lg border border-dashed border-border-default bg-bg-secondary p-3 font-mono text-xs text-text-secondary">
                      Click <strong className="text-text-primary">Generate invite</strong> to create a key — valid for 24h, one-time use (tag:provider). Copy it into the one-liner below. Details in <a href="/docs" className="text-accent-brand underline">/docs</a>.
                    </div>
                  )}
                  {error && <div className="mt-2 font-mono text-xs text-accent-red">{error}</div>}
                </div>

                {/* Command blocks — jedna komenda polecana */}
                <div className="space-y-3">
                    <div className="rounded-xl border border-accent-brand/20 bg-accent-brand/5 p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-accent-brand flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Recommended — one command (auto-authkey + prebuild)
                        </span>
                        <CopyButton text={ONE_LINER_RECOMMENDED} />
                      </div>
                      <pre className="overflow-x-auto rounded-xl border border-accent-brand/20 bg-bg-primary p-3 font-mono text-xs leading-4 text-text-primary">
                        {ONE_LINER_RECOMMENDED}
                      </pre>
                      <p className="mt-2 font-mono text-[11px] leading-3 text-text-secondary">
                        No parameters — <code className="rounded bg-bg-tertiary px-1">install.sh</code> automatically fetches an authkey from{" "}
                        <code className="rounded bg-bg-tertiary px-1">https://seedinfer.com/api/v1/auth/request</code> (tag:provider, 24h) and tries{" "}
                        <code className="rounded bg-bg-tertiary px-1">docker pull ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> → fallback{" "}
                        <code className="rounded bg-bg-tertiary px-1">curl https://seedinfer.com/provider-image.tar.gz | docker load</code> (Pi) → fallback{" "}
                        <code className="rounded bg-bg-tertiary px-1">docker compose build</code> (~28GB). Orange Pi 4 Pro does not build CUDA — it only hosts the tar/registry.
                      </p>
                    <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
                      <span className="rounded bg-bg-tertiary px-2 py-1 text-text-tertiary">Gateway https://seedinfer.com</span>
                      <span className="rounded bg-bg-tertiary px-2 py-1 text-text-tertiary">Tailnet https://tailnet.seedinfer.com</span>
                      <span className="rounded bg-bg-tertiary px-2 py-1 text-text-tertiary">Prebuild ghcr.io → Pi tar → build</span>
                    </div>
                  </div>

                    <details className="rounded-xl border border-border-dim bg-bg-primary">
                      <summary className="cursor-pointer list-none px-4 py-3 font-mono text-xs font-medium text-text-primary flex items-center justify-between">
                        <span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-text-tertiary" /> Advanced — custom authkey / model / gateway</span>
                        <span className="font-mono text-[10px] text-text-tertiary">expand</span>
                      </summary>
                    <div className="space-y-3 border-t border-border-dim p-3">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
                            1 · With key from Generate invite
                          </span>
                          <CopyButton text={oneLinerWithKey} />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-secondary p-3 font-mono text-xs leading-4 text-text-primary">
                          {oneLinerWithKey}
                        </pre>
                        <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                          Use the key from Generate invite above — backward compatible. Same effect as recommended, but with an explicit --authkey.
                        </p>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
                            2 · Auto-fetch key (jq) — scripts
                          </span>
                          <CopyButton text={ONE_LINER_AUTO} />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-secondary p-3 font-mono text-xs leading-4 text-text-secondary">
                          {ONE_LINER_AUTO}
                        </pre>
                        <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                          Manual auto-fetch (now default in <code className="rounded bg-bg-tertiary px-1">install.sh</code> — you don&apos;t need to pass jq).
                        </p>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
                            3 · Full options + env prebuild
                          </span>
                          <CopyButton text={ONE_LINER_CUSTOM} />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-secondary p-3 font-mono text-xs leading-4 text-text-secondary">
                          {ONE_LINER_CUSTOM}
                        </pre>
                        <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                          Custom model/gateway/hostname. ENV override:{" "}
                          <code className="rounded bg-bg-tertiary px-1">SEEDINFER_PREBUILD_IMAGE=ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code>{" "}
                          <code className="rounded bg-bg-tertiary px-1">SEEDINFER_PREBUILD_URL=https://seedinfer.com/provider-image.tar.gz</code>{" "}
                          <code className="rounded bg-bg-tertiary px-1">SEEDINFER_SKIP_PREBUILD=1</code> wymusza build.
                        </p>
                      </div>
                    </div>
                  </details>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href="/install.sh"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-accent-brand hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> https://seedinfer.com/install.sh
                  </a>
                  <span className="font-mono text-xs text-text-tertiary">·</span>
                  <a
                    href="/api/install"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-text-tertiary hover:text-text-primary"
                  >
                    /api/install alias
                  </a>
                  <span className="font-mono text-xs text-text-tertiary">·</span>
                  <a href="/api/v1/auth/request" className="inline-flex items-center gap-1.5 font-mono text-xs text-text-tertiary hover:text-text-primary">
                    /api/v1/auth/request
                  </a>
                  <span className="font-mono text-xs text-text-tertiary">·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-text-tertiary">
                    <Globe className="h-3 w-3" /> dashboard.seedinfer.com
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Steps */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Clock className="h-4 w-4 text-accent-brand" /> Steps — from curl to fleet
                  <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                    ~5 min + 30GB download
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white">
                      1
                    </div>
                    <div className="mt-2 text-sm font-medium text-text-primary">curl install.sh</div>
                    <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                      <code className="rounded bg-bg-tertiary px-1">curl -fsSL https://seedinfer.com/install.sh | bash</code> (auto-authkey)
                      <br />
                      Auto-fetches authkey from <code className="rounded bg-bg-tertiary px-1">/api/v1/auth/request</code> if --authkey is missing, checks <code>nvidia-smi</code> (CUDA 13.3+, driver 580+, VRAM 32GB min), HF model, installs Docker +{" "}
                      <code>nvidia-container-toolkit</code> + <code>tailscale</code> if missing.
                    </div>
                    <pre className="mt-2 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-tertiary">
                      nvidia-smi VRAM OK (&gt;=32GB) HF OK driver 580+ authkey auto-fetched docker pull ghcr.io → Pi tar → build
                    </pre>
                  </li>
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white">
                      2
                    </div>
                    <div className="mt-2 text-sm font-medium text-text-primary">tailscale (Container by default)</div>
                    <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                      <span className="inline-flex items-center rounded bg-accent-green/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-green">Default: Isolated Container</span> — if host is already connected to <code className="rounded bg-bg-tertiary px-1">tailscale.com</code> (100.94.x.x <code className="rounded bg-bg-tertiary px-1">tail*.ts.net</code>), <code className="rounded bg-bg-tertiary px-1">install.sh</code> automatically detects it (<code className="rounded bg-bg-tertiary px-1">tailscale status --json</code>) and launches <code className="rounded bg-bg-tertiary px-1">tailscale-seedinfer</code> as an isolated container (<code className="rounded bg-bg-tertiary px-1">docker run -d --name tailscale-seedinfer ...</code>). Coexistence: Host <code className="rounded bg-bg-tertiary px-1">100.94.x.x</code> (Personal Tailscale) + Container <code className="rounded bg-bg-tertiary px-1">100.64.x.x</code> (Headscale mesh) — will never disconnect your home tailnet. The provider agent uses the container interface.<br />
                      <span className="text-text-tertiary">Compose Alternative:</span> <code className="rounded bg-bg-tertiary px-1">docker compose --profile tailscale up -d</code>. Opt-in host mode: <code className="rounded bg-bg-tertiary px-1">--force-host-tailscale</code> or <code className="rounded bg-bg-tertiary px-1">TAILSCALE_USE_CONTAINER=0</code>. Verification: <code className="rounded bg-bg-tertiary px-1">docker exec tailscale-seedinfer tailscale status</code> (container 100.64.x.x) + <code className="rounded bg-bg-tertiary px-1">tailscale status</code> (host 100.94.x.x intact).
                    </div>
                    <pre className="mt-2 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-tertiary">docker exec tailscale-seedinfer tailscale status  # kontener 100.64.x.x
tailscale status  # host 100.94.x.x (nienaruszony)
docker exec tailscale-seedinfer tailscale ip -4  # 100.64.x.x
ping -c2 gateway.seedinfer.ts.net</pre>
                  </li>
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white">
                      3
                    </div>
                    <div className="mt-2 text-sm font-medium text-text-primary">docker pull / load → up</div>
                    <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                      Klonuje <code className="rounded bg-bg-tertiary px-1">provider/</code> do{" "}
                      <code className="rounded bg-bg-tertiary px-1">/opt/seedinfer-provider</code>, tworzy <code>.env</code>{" "}
                      (VLLM_MODEL=nvidia/...NVFP4), prebuild{" "}
                      <code className="rounded bg-bg-tertiary px-1">docker pull ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> ||{" "}
                      <code className="rounded bg-bg-tertiary px-1">curl https://seedinfer.com/provider-image.tar.gz | docker load</code> (Pi) ||{" "}
                      <code className="rounded bg-bg-tertiary px-1">docker compose up -d --build</code> → vLLM auto-download ~30GB do <code>./models/cache</code>.
                    </div>
                    <pre className="mt-2 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-tertiary">
                      docker pull ghcr.io/...:cuda13.3-nvfp4 || curl https://seedinfer.com/provider-image.tar.gz | docker load || docker compose up --build
                    </pre>
                  </li>
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-green text-xs font-bold text-white">
                      4
                    </div>
                    <div className="mt-2 text-sm font-medium text-text-primary">health → verified → fleet</div>
                    <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                      <code className="rounded bg-bg-tertiary px-1">curl http://127.0.0.1:47901/health</code> +{" "}
                      <code className="rounded bg-bg-tertiary px-1">/v1/models</code> → heartbeat co 30s do{" "}
                      <code className="rounded bg-bg-tertiary px-1">/api/v1/providers/heartbeat</code> → pending → verifying →
                      verified (fleet zielony, opacity 100).
                    </div>
                    <pre className="mt-2 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-tertiary">
                      curl https://seedinfer.com/api/v1/providers | jq
                    </pre>
                  </li>
                </ol>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Health check</div>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">
                      {`curl -fsS http://127.0.0.1:47901/health | jq
# {"status":"ok","provider_id":"...","vllm_health":{"status":"ok"},"gpu":{"count":1}}

curl -fsS http://127.0.0.1:47900/v1/models | jq
curl http://127.0.0.1:47901/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"Hello"}],"max_tokens":32}'`}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Heartbeat + verify</div>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">
                      {`# heartbeat co 30s (agent/main.py)
POST https://seedinfer.com/api/v1/providers/heartbeat
# payload Provider + gpu + host + vllm_health

# auto-verify po 2 heartbeat (~60s)
GET https://seedinfer.com/api/v1/providers
# verification: pending -> verifying -> verified

# manual verify
curl -X POST https://seedinfer.com/api/v1/providers/verify \\
  -H "Content-Type: application/json" \\
  -d '{"provider_id":"provider-5090-xxx"}' | jq`}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Fleet UI</div>
                    <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                      <code className="rounded bg-bg-tertiary px-1">/providers</code> — pending/verifying opacity 60, failed red, verified
                      green (opacity 100) = official node.
                      <br />
                      <code className="rounded bg-bg-tertiary px-1">GET /api/v1/providers?verified=1</code> — verified only.
                      <br />
                      Pi gateway decides <code>verified</code> (not Headscale ACL).
                    </div>
                    <div className="mt-2 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-tertiary">
                      Badge: pending 🟡 verif. 60% → verified 🟢 100% → failed 🔴
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Models NVFP4 */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Cpu className="h-4 w-4 text-accent-brand" /> Models — NVFP4 plug-and-play (Phase 0)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2">ID (MODEL)</th>
                        <th className="px-3 py-2">VLLM_MODEL (HF repo)</th>
                        <th className="px-3 py-2">VRAM</th>
                        <th className="px-3 py-2">Pricing</th>
                        <th className="px-3 py-2">On-disk</th>
                        <th className="px-3 py-2">Ctx</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr className="bg-accent-brand/5">
                        <td className="px-3 py-2 font-medium text-text-primary">seedinfer/nemotron-lightning-1m</td>
                        <td className="px-3 py-2">nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4</td>
                        <td className="px-3 py-2">16-22GB</td>
                        <td className="px-3 py-2">$0.02 / $0.05</td>
                        <td className="px-3 py-2">~20-30GB</td>
                        <td className="px-3 py-2">1M (2M KV)</td>
                        <td className="px-3 py-2">
                          <Badge variant="success" className="text-[10px]">
                            active
                          </Badge>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">gpt-oss-20b</td>
                        <td className="px-3 py-2 text-text-tertiary">alias → seedinfer/nemotron-lightning-1m</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">same</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">1M</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            alias
                          </Badge>
                        </td>
                      </tr>
                      <tr className="opacity-60">
                        <td className="px-3 py-2">qwen3.6-35b-a3b</td>
                        <td className="px-3 py-2">Qwen/Qwen3.6-35B-A3B</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">$0.06 / $0.50</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">131k</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            is coming
                          </Badge>
                        </td>
                      </tr>
                      <tr className="opacity-60">
                        <td className="px-3 py-2">gemma-4-26b-a4b</td>
                        <td className="px-3 py-2">modal —</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">on Modal</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            is coming
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">NVFP4 — vLLM nightly</div>
                    <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                      W4A16 + FP8 KV via ModelOpt → ~16-22GB VRAM (vs 66GB BF16). On-disk ~20-30GB.{" "}
                      <code className="rounded bg-bg-tertiary px-1">pip install --pre vllm --extra-index-url https://wheels.vllm.ai/nightly</code>{" "}
                      + <code className="rounded bg-bg-tertiary px-1">FROM nvidia/cuda:13.3.0-cudnn-devel-ubuntu24.04</code> (fallback 13.3.1/13.2.1, legacy 12.4.1 via PTX JIT). Auto-detect
                      — do not pass <code>--quantization</code> (log: <code>auto</code>). If it fails:{" "}
                      <code>VLLM_QUANTIZATION=modelopt_fp4</code> +{" "}
                      <code className="rounded bg-bg-tertiary px-1">--kv-cache-dtype fp8</code>.
                    </div>
                    <pre className="mt-2 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-tertiary">
                      {`--model nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 \\
--served-model-name seedinfer/nemotron-lightning-1m \\
--max-model-len 1048576 --enable-prefix-caching --enable-chunked-prefill \\
--dtype bfloat16 --gpu-memory-utilization 0.90 --trust-remote-code
# jinja chat_template from HF auto (tokenizer_config.json)`}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Endpoints + pricing</div>
                    <div className="mt-1 flex flex-wrap gap-1 font-mono text-xs">
                      <a
                        href="/api/v1/models"
                        className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary"
                      >
                        /api/v1/models
                      </a>
                      <a
                        href="/api/v1/pricing"
                        className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary"
                      >
                        /api/v1/pricing
                      </a>
                      <a
                        href="/api/v1/fallback/status"
                        className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary"
                      >
                        /api/v1/fallback/status
                      </a>
                      <a
                        href="/api/v1/telemetry"
                        className="rounded bg-bg-tertiary px-2 py-1 text-text-secondary hover:text-text-primary"
                      >
                        /api/v1/telemetry
                      </a>
                    </div>
                    <div className="mt-2 font-mono text-xs text-text-secondary">
                      <strong className="text-text-primary">Fallback:</strong> local (Headscale 100.64.x.x:47901) → NIM → OpenRouter →
                      Modal (Modal warmup parallel po local fail). <code>X-SeedInfer-Upstream</code> header.
                    </div>
                    <div className="mt-2 font-mono text-xs text-text-secondary">
                      <strong className="text-text-primary">Telemetry:</strong> JSONL{" "}
                      <code className="rounded bg-bg-tertiary px-1">/mnt/nvme/telemetry/telemetry.jsonl</code> →{" "}
                      <code className="rounded bg-bg-tertiary px-1">GET /api/v1/telemetry</code> · fallback chain log.
                    </div>
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 font-mono text-[11px] text-text-secondary">
                      On OOM: <code>VLLM_MAX_MODEL_LEN=32768</code> +{" "}
                      <code className="rounded bg-bg-tertiary px-1">VLLM_GPU_MEMORY_UTILIZATION=0.80</code>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* GPU Matrix — CUDA 13.3 */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Cpu className="h-4 w-4 text-accent-brand" /> GPU Matrix — minimum RTX 5090 32GB (CUDA 13.3)
                  <Badge variant="outline" className="ml-2 font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                    Blackwell native
                  </Badge>
                </CardTitle>
                <p className="font-mono text-xs text-text-tertiary">
                  Minimum <strong className="text-text-primary">RTX 5090 32GB (GB202, Blackwell sm_120, 21760 CUDA, 680 Tensor 5th gen, 32GB GDDR7 ~1.8 TB/s)</strong>. NVFP4 30B ~16-22GB + ~6GB KV for 1M ctx = ~22-28GB → 32GB gives headroom with <code className="rounded bg-bg-tertiary px-1">--gpu-memory-utilization 0.90</code> + <code className="rounded bg-bg-tertiary px-1">--max-model-len 1048576</code>. vLLM nightly cu12 wheels run on CUDA 13.3 via PTX JIT (forward-compat, driver 580+).
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2">GPU</th>
                        <th className="px-3 py-2">Arch</th>
                        <th className="px-3 py-2">VRAM</th>
                        <th className="px-3 py-2">BW</th>
                        <th className="px-3 py-2">NVFP4 1M</th>
                        <th className="px-3 py-2">Est. tput*</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr className="bg-accent-brand/10 font-medium text-text-primary">
                        <td className="px-3 py-2">RTX 5090 32GB</td>
                        <td className="px-3 py-2">GB202 sm_120</td>
                        <td className="px-3 py-2">32GB GDDR7</td>
                        <td className="px-3 py-2">~1.8 TB/s</td>
                        <td className="px-3 py-2">✅ ~22-28GB</td>
                        <td className="px-3 py-2">~120-180 tok/s</td>
                        <td className="px-3 py-2"><Badge variant="success" className="text-[10px]">minimum</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">A100 40GB</td>
                        <td className="px-3 py-2">GA100 sm_80</td>
                        <td className="px-3 py-2">40GB HBM2e</td>
                        <td className="px-3 py-2">1.6 TB/s</td>
                        <td className="px-3 py-2">✅ W4A16</td>
                        <td className="px-3 py-2">~60-90</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">A100 80GB</td>
                        <td className="px-3 py-2">GA100</td>
                        <td className="px-3 py-2">80GB HBM2e</td>
                        <td className="px-3 py-2">2.0 TB/s</td>
                        <td className="px-3 py-2">✅</td>
                        <td className="px-3 py-2">~70-100</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">H100 80GB</td>
                        <td className="px-3 py-2">H100 sm_90</td>
                        <td className="px-3 py-2">80GB HBM3</td>
                        <td className="px-3 py-2">3.0 TB/s</td>
                        <td className="px-3 py-2">✅</td>
                        <td className="px-3 py-2">~150-220</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">L40S 48GB</td>
                        <td className="px-3 py-2">AD102 sm_89</td>
                        <td className="px-3 py-2">48GB GDDR6</td>
                        <td className="px-3 py-2">864 GB/s</td>
                        <td className="px-3 py-2">✅</td>
                        <td className="px-3 py-2">~80-120</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">RTX 6000 Ada 48GB</td>
                        <td className="px-3 py-2">AD102</td>
                        <td className="px-3 py-2">48GB GDDR6</td>
                        <td className="px-3 py-2">960 GB/s</td>
                        <td className="px-3 py-2">✅</td>
                        <td className="px-3 py-2">~80-120</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">RTX 6000 Pro Blackwell</td>
                        <td className="px-3 py-2">GB202</td>
                        <td className="px-3 py-2">96GB GDDR7</td>
                        <td className="px-3 py-2">~1.8 TB/s+</td>
                        <td className="px-3 py-2">✅ 96GB</td>
                        <td className="px-3 py-2">~130-190</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">RTX 4500 Blackwell 32GB</td>
                        <td className="px-3 py-2">GB203</td>
                        <td className="px-3 py-2">32GB GDDR7</td>
                        <td className="px-3 py-2">~1.0 TB/s</td>
                        <td className="px-3 py-2">✅</td>
                        <td className="px-3 py-2">~90-130</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">RTX 5000 Blackwell</td>
                        <td className="px-3 py-2">GB203</td>
                        <td className="px-3 py-2">32-48GB GDDR7</td>
                        <td className="px-3 py-2">~1.2 TB/s</td>
                        <td className="px-3 py-2">✅</td>
                        <td className="px-3 py-2">~110-160</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">welcome</Badge></td>
                      </tr>
                      <tr className="opacity-60">
                        <td className="px-3 py-2">RTX 3090 24GB ⏳</td>
                        <td className="px-3 py-2">GA102 sm_86</td>
                        <td className="px-3 py-2">24GB GDDR6X</td>
                        <td className="px-3 py-2">936 GB/s</td>
                        <td className="px-3 py-2">⚠️ 24GB tight</td>
                        <td className="px-3 py-2">~50-80</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">plan</Badge></td>
                      </tr>
                      <tr className="opacity-60">
                        <td className="px-3 py-2">RTX 4090 24GB ⏳</td>
                        <td className="px-3 py-2">AD102 sm_89</td>
                        <td className="px-3 py-2">24GB GDDR6X</td>
                        <td className="px-3 py-2">1.0 TB/s</td>
                        <td className="px-3 py-2">⚠️ tight</td>
                        <td className="px-3 py-2">~70-100</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">plan</Badge></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-dashed border-border-default bg-bg-primary p-3 font-mono text-[11px] leading-4 text-text-secondary">
                  * Est. tput single-user prefill+decode for Nemotron 30B NVFP4 (W4A16+FP8 KV), batch 1, 1k in / 256 out, no prefix cache. Real throughput depends on humming/mamba backend + KV hit. <br />
                  <strong className="text-text-primary">Eventually 3090/4090 (24GB)</strong> — planned as &quot;community&quot; tier with auto-downscale <code className="rounded bg-bg-tertiary px-1">VLLM_MAX_MODEL_LEN=131072</code> and <code className="rounded bg-bg-tertiary px-1">VLLM_GPU_MEMORY_UTILIZATION=0.85</code>. Currently welcome for testing, but the official minimum is 32GB.
                  <br />
                  <strong className="text-text-primary">CUDA 13.3 + driver 580+</strong> required for Blackwell GB202 native (sm_120). Modal/legacy CUDA 12.4 via PTX JIT works without rebuild.
                </div>
              </CardContent>
            </Card>

                        {/* Kontener do pobrania + Pi instructions */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Download className="h-4 w-4 text-accent-brand" /> Kontener do pobrania
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <a
                    href="/provider.tar.gz"
                    className="rounded-xl border border-accent-brand/20 bg-accent-brand/10 p-4 hover:bg-accent-brand/15"
                  >
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      <Download className="h-4 w-4" /> provider.tar.gz
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">Full provider/ pack — Dockerfile.cuda + compose + agent</div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">https://seedinfer.com/provider.tar.gz →</div>
                  </a>
                  <a
                    href="/install.sh"
                    className="rounded-xl border border-border-dim bg-bg-primary p-4 hover:bg-bg-tertiary"
                  >
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      <FileText className="h-4 w-4" /> install.sh
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">One-liner plug-and-play ~279 linii</div>
                    <div className="mt-2 font-mono text-[11px] text-text-tertiary">https://seedinfer.com/install.sh</div>
                  </a>
                  <a href="/docs" className="rounded-xl border border-border-dim bg-bg-primary p-4 hover:bg-bg-tertiary">
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      <Server className="h-4 w-4" /> Control plane
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">
                      Headscale tailnet.seedinfer.com (WireGuard) · Gateway https://seedinfer.com
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">docs.seedinfer.com /docs →</div>
                  </a>
                </div>

                <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                    <HardDrive className="h-3 w-3" /> Instrukcje dla dostawcy
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-3 font-mono text-xs leading-4 text-text-secondary">
                    {`# Provider pack — pobierz i zweryfikuj:
curl -fsSL https://seedinfer.com/provider.tar.gz -o provider.tar.gz && tar tzf provider.tar.gz | head
curl -fsSL https://seedinfer.com/install.sh | head -n 20

# Docs:
# https://seedinfer.com/docs  lub  https://docs.seedinfer.com

# Authkey:
curl -fsSL https://seedinfer.com/api/v1/auth/request | jq
# -> {authkey, expires: "24h", login_server: "https://tailnet.seedinfer.com"}`}
                  </pre>
                  <p className="mt-2 font-mono text-[11px] text-text-tertiary">
                    Details in <a href="/docs" className="text-accent-brand underline">/docs</a> — requirements, ports, troubleshooting and env.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Weryfikacja po instalacji</div>
                    <pre className="mt-1 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">
                      {`# Lokalnie:
curl -fsS http://127.0.0.1:47901/health | jq
curl -fsS http://127.0.0.1:47900/v1/models | jq
docker ps | grep seedinfer-provider

# Gateway:
curl -fsS https://seedinfer.com/api/v1/providers | jq '.data[] | {id,status,verification}'
curl -fsS https://seedinfer.com/api/stats | jq '.active_providers'
# Heartbeat log Pi:
tail -f /mnt/nvme/telemetry/telemetry.jsonl | jq`}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Manual Docker build</div>
                    <pre className="mt-1 rounded-lg bg-bg-tertiary p-2 font-mono text-[11px] text-text-secondary">
                      {`git clone https://github.com/seedinfer/seedinfer.com.git
cd seedinfer.com
cp provider/.env.example provider/.env
# edytuj TAILSCALE_AUTHKEY
docker compose -f provider/docker-compose.yml up -d --build
docker build -f provider/Dockerfile.cuda -t seedinfer/provider:cuda-0.1.0 .`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Provider pack Faza 0 CUDA —{" "}
              <a href="/install.sh" className="text-accent-brand hover:underline">
                /install.sh
              </a>{" "}
              ·{" "}
              <a href="/provider.tar.gz" className="text-accent-brand hover:underline">
                /provider.tar.gz
              </a>{" "}
              ·{" "}
              <a href="/api/v1/auth/request" className="text-accent-brand hover:underline">
                /api/v1/auth/request
              </a>{" "}
              ·{" "}
              <a href="/api/v1/providers" className="text-accent-brand hover:underline">
                /api/v1/providers
              </a>{" "}
              · <a href="/docs" className="text-accent-brand underline">docs.seedinfer.com /docs</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

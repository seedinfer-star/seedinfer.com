"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell, { PageContainer, PageHeader, SectionHeader } from "@/components/app-shell"
import ProviderFleet from "@/components/provider-fleet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Server, Terminal, RefreshCw, FileText, ExternalLink, ShieldCheck, AlertTriangle, KeyRound } from "lucide-react"
import { fetchStats, fetchGatewayProviders } from "@/lib/api"
import type { StatsResponse } from "@/lib/types"
import type { GatewayProvider } from "@/lib/api"
import {
  LIVE_MODEL,
  MIN_VRAM_GB,
  PROVIDER_ECONOMICS,
  REFERENCE_GPU,
  REVENUE_SHARE_PCT,
  SITE_URL,
  priceLabel,
} from "@/lib/catalog"

const INSTALL_URL = `${SITE_URL}/install.sh`
const ONE_LINER_SIMPLE = `curl -fsSL ${INSTALL_URL} | bash -s -- --authkey YOUR_AUTHKEY`
const ONE_LINER_AUTO = `curl -fsSL ${INSTALL_URL} | bash -s -- --authkey $(curl -s ${SITE_URL}/api/v1/auth/request | jq -r .authkey)`
const ONE_LINER_CUSTOM = `curl -fsSL ${INSTALL_URL} | bash -s -- --authkey YOUR_AUTHKEY --model ${LIVE_MODEL.id} --gateway ${SITE_URL} --hostname my-gpu-node`
const HEARTBEAT_S = PROVIDER_ECONOMICS.heartbeatIntervalSec

const VERIFY_SNIPPET = `curl -fsS http://127.0.0.1:47901/health | jq
curl -fsS http://127.0.0.1:47900/v1/models | jq
curl http://127.0.0.1:47901/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${LIVE_MODEL.id}","messages":[{"role":"user","content":"ping"}],"max_tokens":32}'`

const REQUIREMENTS: [string, string][] = [
  ["Model served", `${LIVE_MODEL.name} · ${LIVE_MODEL.contextLabel} ctx`],
  ["GPU", `NVIDIA, ≥ ${MIN_VRAM_GB} GB VRAM (reference: ${REFERENCE_GPU.name})`],
  ["OS", "Ubuntu 24.04 LTS"],
  ["Driver / CUDA", "580.65+ / 13.x"],
  ["Runtime", "Docker 24+ with nvidia-container-toolkit"],
  ["Disk", "≥ 60 GB free (model cache)"],
  ["Ports (host)", "47900 (vLLM) · 47901 (agent)"],
  ["Network", "Outbound UDP 41641 (WireGuard mesh)"],
  ["Payout wallet", `${PROVIDER_ECONOMICS.payoutAsset} on ${PROVIDER_ECONOMICS.payoutChain} (EVM 0x… address)`],
]

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
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-secondary px-2 py-1 font-mono text-[11px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
      aria-label={label ? `Copy: ${label}` : "Copy to clipboard"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function CommandBlock({ title, cmd, note }: { title: string; cmd: string; note?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">{title}</span>
        <CopyButton text={cmd} label={title} />
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border-dim bg-bg-primary p-3 font-mono text-xs leading-5 text-text-primary">
        {cmd}
      </pre>
      {note && <p className="mt-1.5 text-xs text-text-tertiary">{note}</p>}
    </div>
  )
}

export default function ProvidersPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [gateway, setGateway] = useState<GatewayProvider[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const loaded = useRef(false)

  const load = useCallback(async (force = false) => {
    try {
      setError(null)
      if (!loaded.current) setLoading(true)
      const [gw, data] = await Promise.allSettled([fetchGatewayProviders(force), fetchStats(force)])
      if (gw.status === "fulfilled") setGateway(gw.value)
      else setGateway((prev) => prev ?? [])
      if (data.status === "fulfilled") setStats(data.value as StatsResponse)
      if (gw.status === "rejected" && data.status === "rejected") {
        setError((gw as PromiseRejectedResult).reason?.message ?? "Failed to load providers")
      }
      loaded.current = true
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e?.message ?? "Failed to load providers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 15_000)
    return () => clearInterval(id)
  }, [load])

  // One fleet list: gateway registry is the source of truth; fall back to the
  // network snapshot from /api/stats only when the gateway reports no nodes.
  const gatewayList = gateway ?? []
  const usingFallback = gateway !== null && gatewayList.length === 0 && (stats?.providers?.length ?? 0) > 0
  const fleet: GatewayProvider[] = usingFallback ? ((stats?.providers ?? []) as GatewayProvider[]) : gatewayList
  const verifiedCount = gatewayList.filter((g) => g.verification?.status === "verified").length
  const ready = gateway !== null

  return (
    <AppShell>
      <PageHeader
        title="Providers"
        description={
          ready ? (
            <>
              {gatewayList.length} nodes · {verifiedCount} verified · updated {lastFetch}
            </>
          ) : (
            <span className="skeleton inline-block h-2.5 w-40 align-middle" aria-label="Loading" />
          )
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-default bg-bg-secondary px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/provider/portal"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-default bg-bg-secondary px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <KeyRound className="h-3.5 w-3.5 text-accent-brand" />
              <span className="hidden sm:inline">Provider Portal</span>
              <span className="sr-only sm:hidden">Provider Portal</span>
            </Link>
            <Link
              href="/provider"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-brand px-3 text-xs font-medium text-white transition-colors hover:bg-accent-brand-hover"
            >
              <Server className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Become a provider</span>
              <span className="sm:hidden">Join</span>
            </Link>
          </>
        }
      />

      <PageContainer>
        {/* Install */}
        <Card className="overflow-hidden border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary">
          <CardContent className="p-5 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> {REVENUE_SHARE_PCT}% revenue share
              </Badge>
              <Badge variant="outline" className="font-mono">
                {LIVE_MODEL.id}
              </Badge>
              <Badge variant="outline" className="border-accent-brand/30 font-mono text-accent-brand">
                {priceLabel(LIVE_MODEL)} per 1M
              </Badge>
            </div>
            <h2 className="mt-3 flex items-center gap-2 text-base font-semibold tracking-tight text-text-primary">
              <Terminal className="h-4 w-4 text-accent-brand" /> Install a node with one command
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              The installer checks your GPU (<code className="font-mono text-xs">nvidia-smi</code>, ≥ {MIN_VRAM_GB} GB VRAM),
              sets up Docker + the NVIDIA container toolkit, joins the SeedInfer mesh network and starts the inference
              agent. Your node sends a heartbeat every {HEARTBEAT_S} s and is auto-verified after 2 heartbeats.
            </p>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="min-w-0 space-y-4">
                <CommandBlock
                  title="1 · Recommended"
                  cmd={ONE_LINER_SIMPLE}
                  note={
                    <>
                      Replace <code className="font-mono">YOUR_AUTHKEY</code> with a key generated on{" "}
                      <Link href="/provider" className="text-accent-brand hover:underline">
                        Become a provider
                      </Link>
                      .
                    </>
                  }
                />
                <CommandBlock
                  title="2 · Auto-fetch key (needs jq)"
                  cmd={ONE_LINER_AUTO}
                  note="Requests an auth key and installs in one go — handy for scripted setups."
                />
                <CommandBlock title="3 · All options" cmd={ONE_LINER_CUSTOM} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <a href={INSTALL_URL} className="inline-flex items-center gap-1 text-accent-brand hover:underline">
                    <FileText className="h-3.5 w-3.5" /> View install.sh
                  </a>
                  <Link href="/docs" className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                    Hardware docs <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Link href="/provider#install" className="text-text-secondary hover:text-text-primary">
                    Full provider guide →
                  </Link>
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                <Card className="bg-bg-primary/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
                      <ShieldCheck className="h-3.5 w-3.5" /> Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y divide-border-dim text-xs">
                      {REQUIREMENTS.map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between gap-4 py-2">
                          <dt className="shrink-0 text-text-tertiary">{k}</dt>
                          <dd className="text-right font-medium text-text-primary">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
                <div className="rounded-xl border border-border-dim bg-bg-primary/60 p-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">Verify after install</span>
                    <CopyButton text={VERIFY_SNIPPET} label="verify commands" />
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-3 font-mono text-[11px] leading-5 text-text-secondary">
                    {VERIFY_SNIPPET}
                  </pre>
                  <p className="mt-2 text-xs text-text-tertiary">
                    Heartbeat every {HEARTBEAT_S} s · auto-verified after 2 heartbeats.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error} — the provider registry is temporarily unavailable. Retrying every 15 s.</span>
          </div>
        )}

        {/* Fleet — rendered once */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Registry"
            title="Network nodes"
            description={
              usingFallback
                ? "No nodes registered with the gateway yet — showing the latest network snapshot instead."
                : "Verified nodes serve traffic; pending and verifying nodes are shown dimmed."
            }
            actions={
              <>
                <Badge variant={verifiedCount > 0 ? "success" : "outline"} className="font-mono">
                  {verifiedCount} verified · {gatewayList.length} total
                </Badge>
                <a
                  href="/api/v1/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-text-tertiary hover:text-text-primary"
                >
                  JSON <ExternalLink className="h-3 w-3" />
                </a>
              </>
            }
          />

          {!ready ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="h-[220px] p-4">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton mt-3 h-3 w-40" />
                  <div className="skeleton mt-6 h-16 w-full" />
                </Card>
              ))}
            </div>
          ) : fleet.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-sm font-medium text-text-primary">No nodes online yet</div>
              <p className="mx-auto mt-1 max-w-lg text-xs text-text-tertiary">
                Run the installer above. Your node appears here after its first heartbeat and turns green once
                verified (about a minute).
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href="/provider"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-brand px-4 text-sm font-medium text-white hover:bg-accent-brand-hover"
                >
                  <Terminal className="h-4 w-4" /> Become a provider
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-4 text-sm font-medium text-text-primary hover:bg-bg-hover"
                >
                  <FileText className="h-4 w-4" /> Docs
                </Link>
              </div>
            </Card>
          ) : (
            <ProviderFleet title={null} providers={fleet as any} />
          )}
        </section>
      </PageContainer>
    </AppShell>
  )
}

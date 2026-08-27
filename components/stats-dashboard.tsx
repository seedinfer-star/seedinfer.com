"use client"
import { useEffect, useState } from "react"
import Sidebar from "@/components/sidebar"
import KpiGrid from "@/components/kpi-grid"
import NetworkTraffic from "@/components/network-traffic"
import LiveNetworkFlow from "@/components/live-network-flow"
import ProviderFleet from "@/components/provider-fleet"
import ModelsCatalog from "@/components/models-catalog"
import TransparencyFooter from "@/components/transparency-footer"
import HeroMission from "@/components/hero-mission"
import Economics from "@/components/economics"
import Calculator from "@/components/calculator"
import WhiteGlove from "@/components/whiteglove"
import Roadmap from "@/components/roadmap"
import { fetchStats } from "@/lib/api"
import type { StatsResponse } from "@/lib/types"
import { RefreshCw, AlertTriangle, Server, Terminal, FileText } from "lucide-react"
import Link from "next/link"

export default function StatsDashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<string>("")

  const load = async (force = false) => {
    try {
      setError(null)
      if (!stats) setLoading(true)
      const data = await fetchStats(force)
      setStats(data)
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stats — SeedInfer Network Statistics unavailable")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Network stats</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              SeedInfer private inference · live from /api/stats · cache 15s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-[10px] text-text-tertiary sm:inline">Last fetch: {lastFetch || "—"}</span>
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
          <div className="mx-auto max-w-[1600px] space-y-8 p-4 sm:p-6 lg:space-y-10">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Upstream unavailable (502)</div>
                  <div className="mt-0.5 font-mono text-xs leading-4 break-all">{error}</div>
                  <div className="mt-1 font-mono text-[11px] text-accent-red/80">
                    Retrying every 15s. Check{" "}
                    <code className="rounded bg-accent-red/10 px-1">/api/stats</code>
                  </div>
                </div>
              </div>
            )}
            {loading && !stats && !error && (
              <div className="rounded-xl border border-border-dim bg-bg-secondary px-4 py-3 text-sm text-text-tertiary">
                Loading stats from <code className="rounded bg-bg-tertiary px-1">/api/stats</code> …
              </div>
            )}
            {!loading && !stats && error && (
              <div className="rounded-xl border border-border-dim bg-bg-secondary px-4 py-8 text-center">
                <div className="font-mono text-sm font-semibold text-text-primary">No data — upstream unavailable</div>
                <div className="mx-auto mt-2 max-w-xl font-mono text-xs leading-4 text-text-tertiary">
                  Make sure <code className="rounded bg-bg-tertiary px-1">/api/stats</code> is reachable
                  or check the logs. Returning 502 error.
                </div>
              </div>
            )}

            {/* S0 — Hero Mission */}
            <HeroMission />

            {/* S1 — Provider CTA — one-liner + fleet links (SeedInfer-first) */}
            <div className="rounded-xl border border-accent-brand/20 bg-gradient-to-r from-accent-brand/10 via-bg-secondary to-bg-secondary p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-green">NVFP4 · 1M ctx</span>
                    <span className="inline-flex items-center rounded-full border border-border-dim bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary">$0.02 / $0.05 per 1M</span>
                    <span className="inline-flex items-center rounded-full border border-border-dim bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary">CUDA 13.3 · 580+ · 47900/47901</span>
                    <span className="hidden sm:inline font-mono text-[11px] text-text-tertiary">RTX 5090 32GB min · Ubuntu 24.04 · 50GB HF · 60GB+ free</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="text-sm font-semibold text-text-primary">Run a node — Become a Provider</div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-text-secondary">
                      <Terminal className="h-3.5 w-3.5 text-accent-brand" />
                      <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[11px]">curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey hskey-xxx</code>
                      <span className="text-text-tertiary">· host 1:1 marlin/flashinfer/fp8/0.93/128/4096 · fleet</span>
                      <Link href="/providers" className="text-accent-brand hover:underline">/providers</Link>
                      <span className="text-text-tertiary">·</span>
                      <Link href="/docs" className="text-accent-brand hover:underline">/docs</Link>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link href="/provider" className="inline-flex items-center gap-1.5 rounded-xl bg-accent-brand px-4 py-2 text-sm font-semibold text-white hover:bg-accent-brand-hover">
                    <Server className="h-4 w-4" /> Become a Provider →
                  </Link>
                  <Link href="/providers" className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover">
                    <Server className="h-4 w-4" /> Fleet
                  </Link>
                  <Link href="/docs" className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-bg-secondary px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover">
                    <FileText className="h-3.5 w-3.5" /> Docs
                  </Link>
                </div>
              </div>
            </div>

            <KpiGrid stats={stats} loading={loading} />

            {/* S3 — Economics · why 32GB */}
            <Economics />

            <NetworkTraffic stats={stats} />

            <LiveNetworkFlow locations={stats?.provider_locations ?? []} regions={stats?.provider_regions ?? []} />

            {/* S6 — Net-Profit Calculator */}
            <Calculator />

            <ProviderFleet providers={stats?.providers ?? []} />

            {/* S8 — White-Glove Concierge */}
            <WhiteGlove />

            {/* S9 — Roadmap 4 phases */}
            <Roadmap />

            <ModelsCatalog models={stats?.models ?? []} />

            <TransparencyFooter />

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Built with Next.js 15 App Router + Tailwind 3.4 + shadcn/ui + Recharts + MapLibre GL ·
              Data: <code className="rounded bg-bg-tertiary px-1">/api/stats</code> (revalidate 15s). On error returns 502
              with OpenAI-compatible error shape.
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

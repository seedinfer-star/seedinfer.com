"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell, { PageContainer, PageHeader } from "@/components/app-shell"
import KpiGrid from "@/components/kpi-grid"
import NetworkTraffic from "@/components/network-traffic"
import LiveNetworkFlow from "@/components/live-network-flow"
import ProviderFleet from "@/components/provider-fleet"
import ModelsCatalog from "@/components/models-catalog"
import TransparencyFooter from "@/components/transparency-footer"
import Economics from "@/components/economics"
import Calculator from "@/components/calculator"
import WhiteGlove from "@/components/whiteglove"
import Roadmap from "@/components/roadmap"
import { Card } from "@/components/ui/card"
import { fetchStats } from "@/lib/api"
import type { StatsResponse } from "@/lib/types"
import { LIVE_MODEL, REVENUE_SHARE_PCT, priceLabel } from "@/lib/catalog"
import { RefreshCw, AlertTriangle, Server, ArrowRight } from "lucide-react"

const REFRESH_MS = 15_000

export default function StatsDashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const hasData = useRef(false)

  const load = useCallback(async (force = false) => {
    try {
      setError(null)
      if (!hasData.current) setLoading(true)
      const data = await fetchStats(force)
      hasData.current = true
      setStats(data)
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e?.message ?? "Network statistics are temporarily unavailable")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const ready = !!stats

  return (
    <AppShell>
      <PageHeader
        title="Network stats"
        description={
          <>
            Live from <code>/api/stats</code> · refresh 15 s ·{" "}
            {lastFetch ? (
              <>updated {lastFetch}</>
            ) : (
              <span className="skeleton inline-block h-2.5 w-14 align-middle" aria-label="Loading" />
            )}
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => load(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-default bg-bg-secondary px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />

      <PageContainer className="space-y-10">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Network statistics unavailable</div>
              <div className="mt-0.5 break-all font-mono text-xs">{error}</div>
              <div className="mt-1 font-mono text-[11px] text-accent-red/80">
                {ready ? "Showing the last successful snapshot. " : ""}Retrying every 15 s.
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section aria-labelledby="kpi-h" className="space-y-3">
          <h2 id="kpi-h" className="section-title">
            Network at a glance
          </h2>
          <KpiGrid stats={stats} loading={!ready} />
        </section>

        {/* Traffic */}
        {ready ? (
          <NetworkTraffic stats={stats} />
        ) : (
          <ChartsSkeleton />
        )}

        {/* Map */}
        {ready ? (
          <LiveNetworkFlow locations={stats.provider_locations ?? []} regions={stats.provider_regions ?? []} />
        ) : (
          <MapSkeleton />
        )}

        {/* Fleet */}
        {ready ? <ProviderFleet providers={stats.providers ?? []} /> : <FleetSkeleton />}

        {/* Models */}
        {ready ? <ModelsCatalog models={stats.models ?? []} /> : null}

        {/* Provider CTA */}
        <Card className="overflow-hidden border-accent-brand/20 bg-gradient-to-r from-accent-brand/10 via-bg-secondary to-bg-secondary p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-accent-green/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-green">
                  {REVENUE_SHARE_PCT}% revenue share
                </span>
                <span className="inline-flex items-center rounded-full border border-border-dim bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                  Serving {LIVE_MODEL.shortName} · {priceLabel(LIVE_MODEL)} per 1M
                </span>
              </div>
              <h2 className="mt-2 text-base font-semibold tracking-tight text-text-primary">Run a node on your NVIDIA GPU</h2>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                One command installs the agent, joins the network and starts serving. Providers keep {REVENUE_SHARE_PCT}% of
                what their GPU earns.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href="/provider"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-brand px-4 text-sm font-medium text-white transition-colors hover:bg-accent-brand-hover"
              >
                <Server className="h-4 w-4" /> Become a provider
              </Link>
              <Link
                href="/providers"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-default bg-bg-secondary px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Provider fleet <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>

        <Economics />
        <Calculator />
        <WhiteGlove />
        <Roadmap />
        <TransparencyFooter />
      </PageContainer>
    </AppShell>
  )
}

function ChartsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading traffic charts">
      <div className="skeleton h-4 w-32" />
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-[280px] p-4">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton mt-4 h-[210px] w-full" />
          </Card>
        ))}
      </div>
    </div>
  )
}

function MapSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading provider map">
      <div className="skeleton h-4 w-36" />
      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <div className="skeleton h-3 w-44" />
          <div className="skeleton mt-4 h-[360px] w-full rounded-xl" />
        </Card>
        <Card className="space-y-2 p-4">
          <div className="skeleton h-3 w-24" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full" />
          ))}
        </Card>
      </div>
    </div>
  )
}

function FleetSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading provider fleet">
      <div className="skeleton h-4 w-28" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-[220px] p-4">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-3 w-40" />
            <div className="skeleton mt-6 h-16 w-full" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

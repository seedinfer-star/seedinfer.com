"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatTokens, formatNumber, formatPercent, formatTps, compact } from "@/lib/format"
import type { StatsResponse } from "@/lib/types"
import { Activity, Cpu, HardDrive, Layers, MemoryStick, Zap, BarChart3, Globe, Server, Box } from "lucide-react"

type Props = { stats: StatsResponse | null; loading?: boolean }

function SkeletonCard() {
  return (
    <Card className="h-[118px] animate-pulse bg-bg-secondary">
      <CardContent className="p-3">
        <div className="h-3 w-20 rounded bg-bg-tertiary" />
        <div className="mt-3 h-6 w-24 rounded bg-bg-tertiary" />
        <div className="mt-2 h-3 w-16 rounded bg-bg-tertiary" />
      </CardContent>
    </Card>
  )
}

export default function KpiGrid({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  const s = stats
  const utilization = s.network_utilization.utilization
  const bottleneck = s.network_utilization.bottleneck_model
  const activeReq = s.network_utilization.active_requests
  const cap = s.network_capacity_tps
  // "24h" only when the server really holds ~24 h of heartbeat history
  const wh = s.window_hours
  const win = wh === undefined || wh >= 23.5 ? "24h" : wh >= 1 ? `last ${Math.floor(wh)}h` : "last hour"

  const cards = [
    {
      label: "Tokens served",
      value: formatTokens(s.total_tokens),
      sub: `${formatTokens(s.last_24h_total_tokens)} · ${win}`,
      icon: Layers,
      badge: "total",
      hint: `${formatNumber(s.total_requests)} req total`,
    },
    {
      label: "Requests",
      value: compact(s.total_requests),
      sub: `${compact(s.last_24h_requests)} · ${win}`,
      icon: BarChart3,
      badge: `${s.active_providers} active`,
      hint: `${activeReq} active / ${s.network_utilization.queued_requests} queued`,
    },
    {
      label: "Nodes online",
      value: formatNumber(s.active_providers),
      sub: `${formatNumber(s.verified_providers ?? 0)} verified`,
      icon: Server,
      badge: "open network",
      hint: `${formatNumber(s.registered_providers ?? s.active_providers)} registered in total`,
    },
    {
      label: "Memory bandwidth",
      value: `${formatNumber(s.total_bandwidth_gbs)} GB/s`,
      sub: `${formatNumber(Math.round(s.total_bandwidth_gbs / Math.max(1, s.active_providers)))} per node avg`,
      icon: MemoryStick,
      badge: "from GPU specs",
      hint: "sum of online nodes' spec bandwidth",
    },
    {
      label: "Network Power",
      value: formatTps(cap),
      sub: `~${(s.active_power_watts / 1000).toFixed(1)} kW (GPU TDP est.)`,
      icon: Zap,
      badge: `${formatNumber(s.total_memory_gb)} GB RAM`,
      hint: "measured decode tok/s · power estimated",
    },
    {
      label: "Utilization",
      value: formatPercent(utilization),
      sub: `bottleneck ${bottleneck.slice(0, 18)}`,
      icon: Activity,
      badge: `${formatPercent(s.network_utilization.bottleneck_utilization)} bottleneck`,
      hint: `${formatNumber(s.network_utilization.active_requests)} requests in flight`,
      progress: utilization,
    },
    {
      label: "GPU / CPU cores",
      value: `${formatNumber(s.total_gpu_cores)} / ${formatNumber(s.total_cpu_cores)}`,
      sub: `${(s.total_gpu_cores / Math.max(1, s.active_providers)).toFixed(1)} gpu / node`,
      icon: Cpu,
      badge: `${s.active_providers} nodes`,
      hint: "total cores",
    },
    {
      label: "RAM",
      value: `${formatNumber(s.total_memory_gb)} GB`,
      sub: `${Math.round(s.total_memory_gb / Math.max(1, s.active_providers))} GB / node avg`,
      icon: HardDrive,
      badge: `${formatNumber(s.total_memory_gb * 1024)} MB`,
      hint: "aggregate memory",
    },
    {
      label: "Avg tok / req",
      value: formatNumber(Math.round(s.avg_tokens_per_request)),
      sub: `${formatTokens(s.last_24h_total_tokens)} / ${compact(s.last_24h_requests)} · ${win}`,
      icon: Box,
      badge: "mean",
      hint: "all-time, node-reported",
    },
    {
      label: "Models",
      value: `${s.models.length}`,
      sub: s.models.slice(0, 2).map((m) => m.id.split("/").pop()?.slice(0, 12)).join(" · "),
      icon: Globe,
      badge: `${s.models.reduce((a, b) => a + b.providers, 0)} deployments`,
      hint: s.models[0]?.id ?? "",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card key={c.label} className="relative overflow-hidden border border-border-dim bg-bg-secondary">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">{c.label}</span>
                <Icon className="h-3.5 w-3.5 text-text-tertiary" />
              </div>
              <div className="mt-2 font-mono text-[20px] font-bold leading-none tracking-tight text-text-primary">
                {c.value}
              </div>
              <div className="mt-1 truncate text-[11px] leading-4 text-text-secondary">{c.sub}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge variant="outline" className="border-border-dim bg-bg-tertiary/60 px-1.5 py-0 text-[9px] font-mono uppercase tracking-wide text-text-secondary">
                  {c.badge}
                </Badge>
              </div>
              {c.hint && <div className="mt-1 truncate font-mono text-[9px] text-text-tertiary">{c.hint}</div>}
              {c.progress != null && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div className="h-full bg-accent-brand" style={{ width: `${Math.min(100, c.progress * 100)}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

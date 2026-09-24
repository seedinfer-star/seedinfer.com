"use client"
import { useEffect, useState } from "react"
import { fetchStats } from "@/lib/api"
import type { StatsResponse } from "@/lib/types"

const REFRESH_MS = 15_000

/* ------------------------------------------------------------------ */
/* Compact live KPI strip for the landing page ("/").                 */
/* ------------------------------------------------------------------ */

function fmtCompact(n: number | undefined | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—"
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

export function LiveKpiStrip() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const run = (force: boolean) =>
      fetchStats(force)
        .then((d) => {
          if (!alive) return
          setStats(d)
          setFailed(false)
        })
        .catch(() => alive && setFailed(true))
    run(false)
    const id = setInterval(() => run(true), REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const items: { label: string; value: string; hint: string }[] = stats
    ? [
        { label: "Nodes online", value: fmtCompact(stats.active_providers), hint: `${fmtCompact(stats.code_attested_providers)} attested` },
        { label: "Tokens · 24h", value: fmtCompact(stats.last_24h_total_tokens), hint: `${fmtCompact(stats.total_tokens)} all-time` },
        { label: "Requests · 24h", value: fmtCompact(stats.last_24h_requests), hint: `${fmtCompact(stats.total_requests)} all-time` },
        {
          label: "Capacity",
          value: `${fmtCompact(stats.network_capacity_tps)} tok/s`,
          hint: `${fmtCompact(stats.total_memory_gb)} GB VRAM pooled`,
        },
      ]
    : []

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border-dim bg-border-dim lg:grid-cols-4">
      {stats
        ? items.map((it) => (
            <div key={it.label} className="bg-bg-secondary p-4 md:p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">{it.label}</div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">{it.value}</div>
              <div className="mt-0.5 text-xs text-text-tertiary">{it.hint}</div>
            </div>
          ))
        : Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-secondary p-4 md:p-5" aria-busy={!failed}>
              <div className="skeleton h-2.5 w-20" />
              <div className={failed ? "mt-2 text-2xl font-semibold text-text-tertiary" : "skeleton mt-3 h-6 w-16"}>
                {failed ? "—" : null}
              </div>
              <div className="skeleton mt-2 h-2.5 w-24" />
            </div>
          ))}
    </div>
  )
}

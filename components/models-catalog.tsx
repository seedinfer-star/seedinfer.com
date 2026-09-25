"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ModelStat } from "@/lib/types"
import Link from "next/link"
import { Cpu, DollarSign, Zap, Info, Clock, Sparkles, Play, ArrowRight } from "lucide-react"
import { MODELS, CACHE_POLICY, API_BASE_URL, findModel, usd, type CatalogModel } from "@/lib/catalog"

/** Sum provider counts reported by /api/stats for a catalog model (id, aliases or HF id). */
function providersFor(m: CatalogModel, stats: ModelStat[]): number {
  const keys = new Set([m.id, m.hfId, ...m.aliases].filter(Boolean).map((k) => k.toLowerCase()))
  return stats
    .filter((s) => keys.has(String(s.id).toLowerCase()) || findModel(s.id)?.id === m.id)
    .reduce((sum, s) => sum + (Number(s.providers) || 0), 0)
}

function ModelCard({ m, providers }: { m: CatalogModel; providers: number | null }) {
  const live = m.status === "live"
  return (
    <Card
      className={
        live
          ? "border border-accent-brand/20 bg-bg-secondary shadow-sm"
          : "border border-dashed border-border-dim bg-bg-secondary/60"
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle
            className={`min-w-0 break-words text-xs font-mono leading-4 ${live ? "text-text-primary" : "text-text-tertiary"}`}
            title={m.id}
          >
            {m.id}
          </CardTitle>
          {live ? (
            <Badge variant="success" className="shrink-0 font-mono text-[9px]">
              {providers ?? 0} nodes
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 border-accent-amber/20 bg-accent-amber/10 font-mono text-[9px] uppercase tracking-wide text-accent-amber"
            >
              Coming soon
            </Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`truncate text-[11px] font-medium ${live ? "text-text-secondary" : "text-text-tertiary"}`}>{m.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {live && (
            <Badge
              variant="outline"
              className="border-accent-brand/20 bg-accent-brand/10 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wide text-accent-brand"
            >
              Live
            </Badge>
          )}
          <span className="font-mono text-[10px] text-text-tertiary">
            {m.contextLabel} context · {m.quantization.toUpperCase()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border-dim bg-bg-tertiary/60 p-2">
            <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
              <DollarSign className="h-3 w-3" /> Input
            </div>
            <div className={`mt-1 text-xs font-semibold ${live ? "text-text-primary" : "text-text-tertiary"}`}>
              {usd(m.pricePer1M.input)} / 1M
            </div>
          </div>
          <div className="rounded-lg border border-border-dim bg-bg-tertiary/60 p-2">
            <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
              <Zap className="h-3 w-3" /> Output
            </div>
            <div className={`mt-1 text-xs font-semibold ${live ? "text-text-primary" : "text-text-tertiary"}`}>
              {usd(m.pricePer1M.output)} / 1M
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-accent-brand/5 px-2 py-1.5 font-mono text-[10px] text-text-secondary">
          <Info className="h-3 w-3 shrink-0 text-accent-brand" />
          <span className="truncate">Cached input free · 60s TTL (max 5 min)</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-tertiary">
          <Cpu className="h-3 w-3" />
          <span>Providers: {live ? providers ?? 0 : "—"}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ModelsCatalog({ models }: { models: ModelStat[] }) {
  const live = MODELS.filter((m) => m.status === "live")
  const soon = MODELS.filter((m) => m.status === "coming_soon")

  const liveNames = live.map((m) => m.shortName).join(", ")

  return (
    <div className="space-y-3">
      {live.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-accent-brand/30 bg-gradient-to-r from-accent-brand/15 via-bg-secondary to-accent-green/10 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-brand/20 text-accent-brand">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{live.map((m) => m.name).join(", ")} — live</h3>
                  <Badge variant="success" className="font-mono text-[9px] uppercase tracking-wider">
                    <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green" aria-hidden="true" /> Live on network
                  </Badge>
                </div>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">
                  Only {liveNames} is currently active on the network, at{" "}
                  {live.map((m) => (
                    <span key={m.id} className="font-mono font-semibold text-text-primary">
                      {usd(m.pricePer1M.input)} in / {usd(m.pricePer1M.output)} out
                    </span>
                  ))}{" "}
                  per 1M tokens ({live[0].contextLabel} context, cached input free). {soon.map((m) => m.shortName).join(" and ")} are coming soon.
                </p>
              </div>
            </div>
            <Link
              href="/api-console"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-brand-hover"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              Test in API Console
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-text-primary">
          Models &amp; pricing{" "}
          <span className="font-mono text-[10px] font-normal text-text-tertiary">· USD per 1M tokens</span>
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="font-mono text-[10px] uppercase tracking-wide">
            {live.length} live · {soon.length} coming soon
          </Badge>
          <Badge
            variant="outline"
            className="border-border-dim bg-bg-tertiary font-mono text-[10px] uppercase tracking-wide text-text-secondary"
          >
            <Clock className="mr-1 h-3 w-3" /> {CACHE_POLICY.label}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {live.map((m) => (
          <ModelCard key={m.id} m={m} providers={providersFor(m, models)} />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Coming soon</h3>
          <div className="h-px flex-1 bg-border-dim" />
        </div>
        <div className="grid gap-3 opacity-70 sm:grid-cols-2 xl:grid-cols-3">
          {soon.map((m) => (
            <ModelCard key={m.id} m={m} providers={null} />
          ))}
        </div>
      </div>

      <Card className="border border-dashed border-border-default bg-bg-primary/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 font-mono text-[11px] text-text-secondary">
            <span className="rounded-full border border-accent-brand/20 bg-accent-brand/10 px-3 py-1 font-semibold text-accent-brand">
              OpenAI-compatible · {API_BASE_URL}
            </span>
            {MODELS.map((m) => (
              <span
                key={m.id}
                className={`rounded-full border border-border-dim bg-bg-secondary px-3 py-1 ${m.status === "live" ? "" : "opacity-60"}`}
              >
                {m.shortName} · {usd(m.pricePer1M.input)} / {usd(m.pricePer1M.output)} · {m.contextLabel}
                {m.status === "live" ? "" : " · coming soon"}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

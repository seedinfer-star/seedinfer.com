"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ModelStat } from "@/lib/types"
import { Cpu, DollarSign, Zap, Info, Clock, Construction } from "lucide-react"

type Pricing = { input: string; output: string; note?: string }

const FAZA0_ID = "seedinfer/nemotron-lightning-1m"

const PRICING: Record<string, Pricing> = {
  [FAZA0_ID]: {
    input: "$0.02 / 1M",
    output: "$0.05 / 1M",
    note: "1M context · 2M KV · cache 60s free / 5min max",
  },
  // legacy alias — compatibility alias for gpt-oss-20b
  "gpt-oss-20b": {
    input: "$0.02 / 1M",
    output: "$0.05 / 1M",
    note: "alias → seedinfer/nemotron-lightning-1m · 1M ctx · 2M KV · cache 60s free / 5min max",
  },
}

// upcoming models — disabled, badge "is coming" / "coming soon" (not Faza 1)
const UPCOMING: Array<{ id: string; label: string; price: string; note: string }> = [
  {
    id: "qwen3.6-35b-a3b",
    label: "Qwen 3.6 35B A3B",
    price: "$0.06 / $0.50",
    note: "is coming · vision + MoE · 35B A3B",
  },
  {
    id: "gemma-4-26b-a4b",
    label: "Gemma 4 26B A4B",
    price: "on Modal",
    note: "is coming · 26B A4B · also 8-bit on Modal",
  },
]

function isFaza0Model(id: string): boolean {
  const lower = id.toLowerCase()
  return lower.includes("nemotron") || lower.includes("gpt-oss") || id === FAZA0_ID
}

function pricingFor(id: string): Pricing {
  if (PRICING[id]) return PRICING[id]
  if (isFaza0Model(id)) return { input: "$0.02 / 1M", output: "$0.05 / 1M", note: "Nemotron Lightning · 1M ctx · 2M KV" }
  if (id.toLowerCase().includes("qwen"))
    return { input: "$0.06 / 1M", output: "$0.50 / 1M", note: "is coming · Qwen family" }
  if (id.toLowerCase().includes("gemma"))
    return { input: "on Modal", output: "on Modal", note: "is coming · Gemma on Modal" }
  return { input: "—", output: "—", note: "custom" }
}

export default function ModelsCatalog({ models }: { models: ModelStat[] }) {
  const sorted = [...models].sort((a, b) => b.providers - a.providers)
  const faza0Models = sorted.filter((m) => isFaza0Model(m.id))

  const displayFaza0: ModelStat[] =
    faza0Models.length > 0
      ? faza0Models
      : models.length === 0
        ? []
        : [{ id: FAZA0_ID, providers: 0 }]

  const displayLabel = (id: string) => (id === "gpt-oss-20b" ? `${FAZA0_ID} (alias gpt-oss-20b)` : id)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-text-primary">
          Models catalog + pricing{" "}
          <span className="font-mono text-[10px] font-normal text-text-tertiary">· Faza 0</span>
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="font-mono text-[10px] uppercase tracking-wide">
            Faza 0: tylko Nemotron
          </Badge>
          <Badge variant="outline" className="border-border-dim bg-bg-tertiary font-mono text-[10px] uppercase tracking-wide text-text-secondary">
            <Clock className="mr-1 h-3 w-3" /> cache 60s free / 5min max
          </Badge>
        </div>
      </div>

      {/* Faza 0 banner — info o tailnecie */}
      <div className="flex items-start gap-2 rounded-xl border border-accent-brand/20 bg-accent-brand/10 px-3 py-2.5">
        <Construction className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] font-semibold leading-4 text-text-primary">
            Faza 0: tylko Nemotron Lightning 1M (2M KV) — $0.02 / 1M input · $0.05 / 1M output
          </div>
          <div className="mt-0.5 font-mono text-[11px] leading-4 text-text-secondary">
            Tailnet w budowie — Headscale control plane (tailnet.seedinfer.com) + provider RTX 5090 (tag:provider).
            Qwen 3.6 35B A3B i Gemma 4 26B A4B jako <span className="font-semibold text-text-primary">„is coming” / „coming soon”</span>.
            Cache: prefix caching 60s free, 5 min max.
          </div>
        </div>
        <Badge variant="outline" className="hidden shrink-0 border-accent-brand/20 bg-bg-secondary font-mono text-[10px] sm:inline-flex">
          seedinfer/nemotron-lightning-1m
        </Badge>
      </div>

      {/* Faza 0 — tylko Nemotron (active) */}
      {displayFaza0.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayFaza0.map((m) => {
            const p = pricingFor(m.id)
            return (
              <Card key={m.id} className="border border-accent-brand/20 bg-bg-secondary shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle
                      className="min-w-0 break-all text-xs font-mono leading-4 text-text-primary"
                      title={m.id}
                    >
                      {displayLabel(m.id)}
                    </CardTitle>
                    <Badge variant="success" className="shrink-0 font-mono text-[9px]">
                      {m.providers} nodes
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="outline" className="border-accent-brand/20 bg-accent-brand/10 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wide text-accent-brand">
                      Faza 0 · active
                    </Badge>
                    <span className="font-mono text-[10px] text-text-tertiary">1M ctx · 2M KV</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border-dim bg-bg-tertiary/60 p-2">
                      <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <DollarSign className="h-3 w-3" /> Input
                      </div>
                      <div className="mt-1 text-xs font-semibold text-text-primary">{p.input}</div>
                    </div>
                    <div className="rounded-lg border border-border-dim bg-bg-tertiary/60 p-2">
                      <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <Zap className="h-3 w-3" /> Output
                      </div>
                      <div className="mt-1 text-xs font-semibold text-text-primary">{p.output}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-accent-brand/5 px-2 py-1.5 font-mono text-[10px] text-text-secondary">
                    <Info className="h-3 w-3 shrink-0 text-accent-brand" />
                    <span className="truncate">{p.note}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-tertiary">
                    <Cpu className="h-3 w-3" />
                    <span>Providers: {m.providers}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border border-dashed border-border-dim bg-bg-secondary">
          <CardContent className="p-4 text-center font-mono text-xs text-text-tertiary">
            Brak danych — oczekiwanie na /api/stats … (Faza 0: seedinfer/nemotron-lightning-1m)
          </CardContent>
        </Card>
      )}

      {/* coming soon: Qwen / Gemma jako disabled placeholders */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">coming soon</h3>
          <div className="h-px flex-1 bg-border-dim" />
          <span className="font-mono text-[10px] text-text-tertiary">is coming · provider tailnet under construction</span>
        </div>
        <div className="grid gap-3 opacity-60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {UPCOMING.map((s) => (
            <Card key={s.id} className="border border-dashed border-border-dim bg-bg-secondary/60">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 break-all text-xs font-mono leading-4 text-text-tertiary" title={s.id}>
                    {s.id}
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0 border-accent-amber/20 bg-accent-amber/10 font-mono text-[9px] uppercase tracking-wide text-accent-amber">
                    is coming
                  </Badge>
                </div>
                <div className="truncate text-[11px] font-medium text-text-tertiary">{s.label}</div>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border-dim bg-bg-tertiary/40 p-2">
                    <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                      <DollarSign className="h-3 w-3" /> Input
                    </div>
                    <div className="mt-1 text-xs font-semibold text-text-tertiary">{s.price.split(" / ")[0] ?? s.price}</div>
                  </div>
                  <div className="rounded-lg border border-border-dim bg-bg-tertiary/40 p-2">
                    <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                      <Zap className="h-3 w-3" /> Output
                    </div>
                    <div className="mt-1 text-xs font-semibold text-text-tertiary">{s.price.split(" / ")[1] ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-bg-tertiary/40 px-2 py-1.5 font-mono text-[10px] text-text-tertiary">
                  <Info className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.note}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-tertiary">
                  <Cpu className="h-3 w-3" />
                  <span>Providers: —</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border border-dashed border-border-default bg-bg-primary/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 font-mono text-[11px] text-text-secondary">
            <span className="rounded-full border border-accent-brand/20 bg-accent-brand/10 px-3 py-1 font-semibold text-accent-brand">
              Faza 0 · Nemotron $0.02 / $0.05 · 1M ctx · 2M KV · cache 60s free / 5min max
            </span>
            <span className="rounded-full border border-border-dim bg-bg-secondary px-3 py-1 opacity-60">
              Qwen 3.6 35B A3B · is coming
            </span>
            <span className="rounded-full border border-border-dim bg-bg-secondary px-3 py-1 opacity-60">
              Gemma 4 26B A4B · is coming
            </span>
            <span className="rounded-full border border-accent-green/20 bg-accent-green/10 px-3 py-1 text-accent-green">Cache 60s free · 5min max · prefix caching</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ModelStat } from "@/lib/types"
import { ShieldCheck, Sparkles, CheckCircle2, ArrowRight, Play, Server, Clock } from "lucide-react"

export default function ModelsCatalog({ models }: { models: ModelStat[] }) {
  const gemmaNodes = models.find((m) => m.id.includes("gemma"))?.providers ?? 1

  return (
    <div className="space-y-8">
      {/* Active Model Announcement Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-accent-brand/30 bg-gradient-to-r from-accent-brand/15 via-bg-secondary to-accent-green/10 p-5 shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-brand/20 text-accent-brand shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">Gemma 4 26B A4B NVFP4 — Currently Live & Active</h3>
                <Badge variant="success" className="font-mono text-[9px] uppercase tracking-wider">
                  <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green inline-block" /> LIVE ON NETWORK
                </Badge>
              </div>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed max-w-3xl">
                Only Gemma 4 26B A4B is currently active on hardware-attested RTX 5090 nodes. 
                Enjoy ultra-low TTFT (<span className="font-mono font-medium text-accent-green">P99 &lt; 50ms</span>) at <span className="font-mono font-semibold text-text-primary">$0.030 In / $0.200 Out</span> per 1M tokens — <span className="font-semibold text-accent-green">28.6% cheaper on input</span> than Darkbloom ($0.042 In).
              </p>
            </div>
          </div>
          <a
            href="/api-console"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent-brand px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-accent-brand-hover hover:shadow-lg active:scale-95"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Test in API Console
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Section 1: Available Models Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text-primary flex items-center gap-2">
            Available Models
          </h2>
          <p className="text-xs text-text-tertiary">
            Models served by hardware-attested providers on the SeedInfer network.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Active Model Card: Gemma 4 26B */}
          <Card className="relative overflow-hidden border-2 border-accent-green/40 bg-bg-secondary shadow-lg transition-all hover:border-accent-green hover:shadow-xl">
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-accent-green/10 blur-xl pointer-events-none" />
            
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-green/15 text-accent-green font-bold text-sm">
                    G
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight text-text-primary">
                      gemma-4-26b
                    </CardTitle>
                    <div className="font-mono text-[10px] text-text-tertiary">google/gemma-4-26b-a4b-nvfp4</div>
                  </div>
                </div>
                <Badge variant="success" className="font-mono text-[9px] uppercase tracking-wider gap-1 border-accent-green/40 bg-accent-green/15 text-accent-green">
                  <ShieldCheck className="h-3 w-3" /> HARDWARE
                </Badge>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary">text</span>
                <span className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary">256K ctx</span>
                <span className="rounded-md bg-accent-brand/10 border border-accent-brand/20 px-2 py-0.5 font-mono text-[10px] font-medium text-accent-brand">nvfp4</span>
                <span className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-tertiary">RTX 5090</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-0">
              {/* Price Box */}
              <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-sm font-extrabold text-text-primary">
                    $0.030 <span className="text-xs font-normal text-text-tertiary">/ $0.200</span>
                  </div>
                  <span className="rounded-full bg-accent-green/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-accent-green border border-accent-green/30">
                    28.6% cheaper input vs Darkbloom
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-text-tertiary">per 1M tokens ($0.030 In / $0.200 Out)</div>
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between border-t border-border-dim pt-3 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Server className="h-3.5 w-3.5 text-accent-green" />
                  <span className="font-semibold text-text-primary">{gemmaNodes} provider</span>
                </div>
                <div className="flex items-center gap-1 text-accent-green font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Attested Node</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Models (Without prices - TBA) */}
          <Card className="border border-border-dim bg-bg-secondary/40 opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary font-bold text-sm text-text-tertiary">
                    G
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight text-text-secondary">
                      gpt-oss-20b
                    </CardTitle>
                    <div className="font-mono text-[10px] text-text-tertiary">seedinfer/nemotron-lightning-1m</div>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-wider text-text-tertiary">
                  COMING SOON
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-tertiary">gpt_oss</span>
                <span className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-tertiary">1M ctx</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-0">
              <div className="rounded-xl border border-border-dim bg-bg-tertiary/30 p-3 text-center">
                <div className="font-mono text-xs font-medium text-text-tertiary">
                  Price TBA upon node onboarding
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border-dim pt-3 font-mono text-[11px] text-text-tertiary">
                <span>0 providers</span>
                <span className="italic flex items-center gap-1"><Clock className="h-3 w-3" /> Queued</span>
              </div>
            </CardContent>
          </Card>

          {/* Qwen 3.5 35B A3B */}
          <Card className="border border-border-dim bg-bg-secondary/40 opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary font-bold text-sm text-text-tertiary">
                    Q
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight text-text-secondary">
                      qwen3.5-35b-a3b
                    </CardTitle>
                    <div className="font-mono text-[10px] text-text-tertiary">qwen/qwen3.5-35b-a3b</div>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-wider text-text-tertiary">
                  COMING SOON
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-tertiary">qwen3_5_moe</span>
                <span className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-tertiary">262K ctx</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-0">
              <div className="rounded-xl border border-border-dim bg-bg-tertiary/30 p-3 text-center">
                <div className="font-mono text-xs font-medium text-text-tertiary">
                  Price TBA upon node onboarding
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border-dim pt-3 font-mono text-[11px] text-text-tertiary">
                <span>0 providers</span>
                <span className="italic flex items-center gap-1"><Clock className="h-3 w-3" /> Queued</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Pricing vs Baseline Table */}
      <div className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text-primary">
            Pricing vs Competitors & Baseline
          </h2>
          <p className="text-xs text-text-tertiary">
            SeedInfer runs on hardware-attested RTX 5090 nodes, benchmarked against market providers.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-dim bg-bg-secondary shadow-md">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-border-dim bg-bg-tertiary/60 text-[11px] font-semibold text-text-tertiary">
              <tr>
                <th className="px-5 py-3.5">MODEL</th>
                <th className="px-5 py-3.5">SeedInfer</th>
                <th className="px-5 py-3.5">DARKBLOOM (CHEAPEST)</th>
                <th className="px-5 py-3.5">TYPICAL API BASELINE</th>
                <th className="px-5 py-3.5 text-right">SAVINGS VS DARKBLOOM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dim/50">
              {/* Gemma 4 26B Row (ACTIVE) */}
              <tr className="bg-accent-green/5 transition-colors hover:bg-accent-green/10">
                <td className="px-5 py-4 font-semibold text-text-primary">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-accent-green" />
                    <span>Gemma 4 26B</span>
                    <span className="text-[10px] font-normal text-text-tertiary">per 1M tokens</span>
                  </div>
                </td>
                <td className="px-5 py-4 font-bold text-text-primary">
                  $0.030 In / $0.200 Out
                </td>
                <td className="px-5 py-4 text-text-secondary font-medium">
                  $0.042 In / $0.220 Out
                </td>
                <td className="px-5 py-4 text-text-tertiary">
                  $0.330 <span className="text-[10px]">typical APIs</span>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-flex items-center rounded-full bg-accent-green/20 border border-accent-green/40 px-2.5 py-1 text-[11px] font-extrabold text-accent-green">
                    28.6% cheaper input
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="border-t border-border-dim bg-bg-tertiary/40 px-5 py-2.5 font-mono text-[10px] text-text-tertiary">
            Comparison data benchmarked against Darkbloom ($0.042 In / $0.220 Out) and typical hosted API baselines as of August 2026.
          </div>
        </div>
      </div>
    </div>
  )
}

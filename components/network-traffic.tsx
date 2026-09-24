"use client"
import { useMemo, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { StatsResponse, TimePoint } from "@/lib/types"

type Range = "30m" | "24h" | "7d" | "30d"
type Mode = "per-minute" | "cumulative"

function fmtTime(ts: string) {
  const d = new Date(ts)
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function sliceRange(series: TimePoint[], range: Range): TimePoint[] {
  // parity: API only returns 30m — 24h/7d/30d disabled (no fake data)
  if (range === "30m") return series.slice(-30)
  // fallback — should not be reachable because buttons disabled, but keep safe
  return series.slice(-30)
}

function toCumulative(series: TimePoint[]) {
  let accReq = 0
  let accPrompt = 0
  let accComp = 0
  return series.map((p) => {
    accReq += p.requests
    accPrompt += p.prompt_tokens
    accComp += p.completion_tokens
    return { ...p, requests: accReq, prompt_tokens: accPrompt, completion_tokens: accComp, total_tokens: accPrompt + accComp }
  })
}

export default function NetworkTraffic({ stats }: { stats: StatsResponse | null }) {
  const [range, setRange] = useState<Range>("30m")
  const [mode, setMode] = useState<Mode>("per-minute")

  const series = useMemo(() => {
    if (!stats) return []
    let s = sliceRange(stats.time_series, range)
    if (mode === "cumulative") s = toCumulative(s)
    return s.map((p) => ({
      time: fmtTime(p.timestamp),
      ts: p.timestamp,
      requests: p.requests,
      prompt: p.prompt_tokens,
      completion: p.completion_tokens,
      total: p.total_tokens,
    }))
  }, [stats, range, mode])

  const totals = useMemo(() => {
    if (!stats) return { prompt: 0, completion: 0 }
    const s = sliceRange(stats.time_series, range)
    return {
      prompt: s.reduce((a, b) => a + b.prompt_tokens, 0),
      completion: s.reduce((a, b) => a + b.completion_tokens, 0),
    }
  }, [stats, range])

  const donutData = [
    { name: "Input", value: totals.prompt, color: "#818cf8" },
    { name: "Output", value: totals.completion, color: "#34d399" },
  ]

  const ranges: Range[] = ["30m", "24h", "7d", "30d"]

  return (
    <div className="space-y-3">
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-text-primary">Network traffic</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border-dim bg-bg-tertiary p-1">
            {ranges.map((r) => {
              const disabled = r !== "30m"
              return (
                <button
                  key={r}
                  onClick={() => {
                    if (!disabled) setRange(r)
                  }}
                  disabled={disabled}
                  title={disabled ? "only 30m from API — 24h/7d/30d soon" : undefined}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    range === r ? "bg-bg-secondary text-text-primary shadow-sm border border-border-dim" : "text-text-tertiary hover:text-text-secondary",
                    disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {r}
                </button>
              )
            })}
          </div>
          <div className="inline-flex rounded-lg border border-border-dim bg-bg-tertiary p-1">
            <button
              onClick={() => setMode("per-minute")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                mode === "per-minute" ? "bg-bg-secondary text-text-primary shadow-sm border border-border-dim" : "text-text-tertiary"
              )}
            >
              Per minute
            </button>
            <button
              onClick={() => setMode("cumulative")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                mode === "cumulative" ? "bg-bg-secondary text-text-primary shadow-sm border border-border-dim" : "text-text-tertiary"
              )}
            >
              Cumulative
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Requests/min */}
        <Card className="border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              Requests / min
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="reqFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--text-tertiary)", fontSize: 11 }}
                />
                <Area type="monotone" dataKey="requests" stroke="#818cf8" strokeWidth={1.8} fill="url(#reqFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tokens/min stacked */}
        <Card className="border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              Tokens / min — stacked Input / Output
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="promptFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="compFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickFormatter={(v) => (v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : String(v))} tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="prompt" stackId="1" stroke="#818cf8" fill="url(#promptFill)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="completion" stackId="1" stroke="#34d399" fill="url(#compFill)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-1 flex items-center justify-center gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#818cf8]" /> Input</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34d399]" /> Output</span>
            </div>
          </CardContent>
        </Card>

        {/* Token Distribution donut */}
        <Card className="border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              Token Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px] p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={78}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [(v as number).toLocaleString(), "tokens"]}
                  contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center font-mono text-[10px] text-text-tertiary">
              {((totals.completion / Math.max(1, totals.prompt + totals.completion)) * 100).toFixed(1)}% output · {((totals.prompt / Math.max(1, totals.prompt + totals.completion)) * 100).toFixed(1)}% input
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

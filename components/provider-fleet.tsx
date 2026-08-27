"use client"
import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { Provider } from "@/lib/types"
import { Cpu, HardDrive, MemoryStick, ShieldCheck, Search, Activity, Zap, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"

type Props = { providers: Provider[] & Array<Provider & { verification?: { status: string; checks?: any[]; last_check?: string | null; failure_reason?: string } }> }

type SortKey = "tokens" | "requests" | "memory" | "gpu"

export default function ProviderFleet({ providers }: Props) {
  const [q, setQ] = useState("")
  const [model, setModel] = useState("all")
  const [trust, setTrust] = useState("all")
  const [status, setStatus] = useState("all")
  const [sort, setSort] = useState<SortKey>("tokens")

  const models = useMemo(() => {
    const s = new Set<string>()
    providers.forEach((p) => p.models.forEach((m) => s.add(m)))
    return ["all", ...Array.from(s).sort()]
  }, [providers])

  const filtered = useMemo(() => {
    let arr = [...providers]
    if (q) {
      const qq = q.toLowerCase()
      arr = arr.filter((p) => p.chip.toLowerCase().includes(qq) || p.id.toLowerCase().includes(qq) || p.current_model.toLowerCase().includes(qq))
    }
    if (model !== "all") arr = arr.filter((p) => p.models.includes(model) || p.current_model === model)
    if (trust !== "all") arr = arr.filter((p) => p.trust_level === trust)
    if (status !== "all") arr = arr.filter((p) => p.status === status)
    arr.sort((a, b) => {
      if (sort === "tokens") return b.tokens_generated - a.tokens_generated
      if (sort === "requests") return b.requests_served - a.requests_served
      if (sort === "memory") return b.memory_gb - a.memory_gb
      if (sort === "gpu") return b.gpu_cores - a.gpu_cores
      return 0
    })
    return arr.slice(0, 60)
  }, [providers, q, model, trust, status, sort])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-text-primary">
          Provider fleet{" "}
          <span className="font-mono text-xs font-normal text-text-tertiary">· {providers.length} total · showing {filtered.length}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <Input placeholder="Filter chip, model, id…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-[220px] pl-8" />
          </div>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="h-8 rounded-lg border border-border-default bg-bg-secondary px-2 text-xs text-text-primary">
            {models.slice(0, 20).map((m) => (
              <option key={m} value={m}>
                {m === "all" ? "All models" : m}
              </option>
            ))}
          </select>
          <select value={trust} onChange={(e) => setTrust(e.target.value)} className="h-8 rounded-lg border border-border-default bg-bg-secondary px-2 text-xs text-text-primary">
            <option value="all">All trust</option>
            <option value="hardware">hardware</option>
            <option value="self_signed">self_signed</option>
            <option value="none">none</option>
            <option value="software">software</option>
            <option value="unverified">unverified</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-lg border border-border-default bg-bg-secondary px-2 text-xs text-text-primary">
            <option value="all">All status</option>
            <option value="online">online</option>
            <option value="serving">serving</option>
            <option value="offline">offline</option>
            <option value="draining">draining</option>
            <option value="untrusted">untrusted</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-8 rounded-lg border border-border-default bg-bg-secondary px-2 text-xs text-text-primary">
            <option value="tokens">Sort: tokens</option>
            <option value="requests">Sort: requests</option>
            <option value="memory">Sort: memory</option>
            <option value="gpu">Sort: GPU cores</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => {
          const verification = (p as any).verification as { status?: string; checks?: any[]; failure_reason?: string } | undefined
          const vStatus = verification?.status
          const isVerified = vStatus === "verified"
          const isPending = vStatus === "pending"
          const isVerifying = vStatus === "verifying"
          const isFailed = vStatus === "failed"
          const hasVerification = !!vStatus
          // only verified is an official node — others have opacity 60 + pending badge
          const cardOpacity = hasVerification && !isVerified ? "opacity-60" : ""
          const vBadgeClass =
            isVerified ? "bg-accent-green/15 text-accent-green border-accent-green/20" :
            isPending ? "bg-accent-amber/15 text-accent-amber border-accent-amber/20" :
            isVerifying ? "bg-accent-brand/15 text-accent-brand border-accent-brand/20" :
            isFailed ? "bg-accent-red/15 text-accent-red border-accent-red/20" : ""
          const vIcon = isVerified ? <CheckCircle2 className="h-3 w-3" /> : isPending ? <Clock className="h-3 w-3" /> : isVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : isFailed ? <XCircle className="h-3 w-3" /> : null
          return (
          <Card key={p.id} className={`border border-border-dim bg-bg-secondary transition-colors hover:border-border-subtle ${cardOpacity}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="min-w-0 truncate text-[11px] font-mono leading-4 text-text-primary" title={p.id}>
                  {p.id.slice(0, 8)}…{p.id.slice(-4)}
                </CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  {hasVerification && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase ${vBadgeClass}`} title={verification?.failure_reason || vStatus}>
                      {vIcon} {vStatus}
                    </span>
                  )}
                  <Badge
                    variant={
                      p.status === "online" || p.status === "serving"
                        ? "success"
                        : p.status === "draining" || p.status === "untrusted"
                          ? "warning"
                          : "outline"
                    }
                    className="shrink-0 font-mono text-[9px] uppercase"
                  >
                    {p.status}
                  </Badge>
                </div>
              </div>
              <div className="truncate text-xs font-medium text-text-primary">{p.chip}</div>
              <div className="truncate font-mono text-[10px] text-text-tertiary">
                {p.chip_family} · {p.chip_tier} · {p.machine_model}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              <div className="flex flex-wrap gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary">
                  <Cpu className="h-3 w-3" /> {p.gpu_cores} GPU
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary">
                  <HardDrive className="h-3 w-3" /> {p.memory_gb} GB
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary">
                  <MemoryStick className="h-3 w-3" /> {p.memory_bandwidth_gbs} GB/s
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary">
                  <Cpu className="h-3 w-3" /> {p.cpu_cores?.total ?? "—"} CPU
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary">
                  <Zap className="h-3 w-3" /> {typeof p.decode_tps === "number" ? p.decode_tps.toFixed(1) : "0.0"} tps
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary" title={p.machine_model}>
                  <Activity className="h-3 w-3" /> {p.machine_model || "—"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] ${
                    p.trust_level === "hardware" ? "bg-accent-green/10 text-accent-green" : "bg-accent-amber/10 text-accent-amber"
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" /> {p.trust_level}
                </span>
                {p.mda_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 px-2 py-1 font-mono text-[10px] text-accent-green">
                    <ShieldCheck className="h-3 w-3" /> MDA ✓
                  </span>
                )}
                {p.runtime_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-brand/10 px-2 py-1 font-mono text-[10px] text-accent-brand">
                    <ShieldCheck className="h-3 w-3" /> runtime ✓
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-border-dim bg-bg-tertiary/60 p-2">
                <div className="truncate font-mono text-[10px] text-text-secondary">{p.current_model}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.models.slice(0, 3).map((m) => (
                    <span key={m} className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-text-tertiary">
                      {m.split("/").pop()}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                <div className="rounded bg-bg-tertiary px-2 py-1.5">
                  <div className="text-text-tertiary">Requests</div>
                  <div className="font-semibold text-text-primary">{p.requests_served.toLocaleString()}</div>
                </div>
                <div className="rounded bg-bg-tertiary px-2 py-1.5">
                  <div className="text-text-tertiary">Tokens</div>
                  <div className="font-semibold text-text-primary">{p.tokens_generated.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="border border-border-dim bg-bg-secondary p-8 text-center text-sm text-text-tertiary">No providers match filters.</Card>
      )}
    </div>
  )
}

"use client"
import { useEffect, useState } from "react"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, ExternalLink, RefreshCw, Crown } from "lucide-react"

type Entry = {
  rank: number
  pseudonym: string
  earnings_micro_usd: number
  work_earnings_micro_usd: number
  reward_earnings_micro_usd: number
  tokens: number
  jobs: number
}

const MOCK: Entry[] = [
  { rank: 1, pseudonym: "forest-komodo-7812", earnings_micro_usd: 180963475, work_earnings_micro_usd: 136704277, reward_earnings_micro_usd: 44259198, tokens: 2731825520, jobs: 603515 },
  { rank: 2, pseudonym: "beamy-puppy-4259", earnings_micro_usd: 143527444, work_earnings_micro_usd: 108333607, reward_earnings_micro_usd: 35193837, tokens: 1862570874, jobs: 387892 },
  { rank: 3, pseudonym: "proud-alligator-9642", earnings_micro_usd: 69987889, work_earnings_micro_usd: 53289271, reward_earnings_micro_usd: 16698618, tokens: 1064891038, jobs: 265290 },
]

function fmtUSD(micro: number) {
  return `$${(micro / 1e6).toFixed(2)}`
}
function fmtTokens(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B"
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"
  return String(n)
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string>("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch("https://api.seedinfer.com/v1/leaderboard?metric=earnings&window=7d", { cache: "no-store" })
      if (!r.ok) throw new Error(`upstream ${r.status}`)
      const j = await r.json()
      if (j?.entries && Array.isArray(j.entries)) {
        setEntries(j.entries.slice(0, 50))
        setUpdatedAt(j.updated_at ?? new Date().toISOString())
      } else {
        throw new Error("invalid payload")
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch — upstream https://api.seedinfer.com/v1/leaderboard unavailable (no mock fallback)")
      setEntries([])
      setUpdatedAt("")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Leaderboard</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              7d earnings · https://api.seedinfer.com/v1/leaderboard?metric=earnings&window=7d · updated {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://docs.seedinfer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              docs.seedinfer.com <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
            <Card className="border border-amber-500/20 bg-amber-500/10">
              <CardContent className="p-3 flex items-start gap-2">
                <Trophy className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary">Coming soon — proxy to docs.seedinfer.com</div>
                  <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                    This leaderboard proxies <code className="rounded bg-bg-tertiary px-1">https://api.seedinfer.com/v1/leaderboard</code> and will move to <code className="rounded bg-bg-tertiary px-1">api.seedinfer.com</code> after proxy cutover. See{" "}
                    <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-brand underline">
                      docs.seedinfer.com
                    </a>{" "}
                    for API reference. If upstream is unreachable, shows 502 error — no mock fallback.
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-500/20 bg-bg-secondary font-mono text-[10px]">7d · earnings</Badge>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
                {error} — no mock fallback, showing empty.
              </div>
            )}
            {!loading && entries.length === 0 && !error && (
              <div className="rounded-xl border border-border-dim bg-bg-secondary px-4 py-6 text-center text-sm text-text-tertiary">
                No data — awaiting upstream …
              </div>
            )}
            {!loading && entries.length === 0 && error && (
              <div className="rounded-xl border border-border-dim bg-bg-secondary px-4 py-6 text-center text-sm text-text-tertiary">
                No data — upstream unavailable (502). No mock fallback.
              </div>
            )}

            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-[13px]">
                    <Crown className="h-4 w-4 text-accent-amber" />
                    Top providers — 7 days
                    <span className="font-mono text-xs font-normal text-text-tertiary">· {entries.length} entries</span>
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px]">metric=earnings · window=7d</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="border-y border-border-dim bg-bg-tertiary/60 text-[10px] uppercase tracking-wider text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Pseudonym</th>
                        <th className="px-3 py-2 font-medium text-right">Earnings</th>
                        <th className="px-3 py-2 font-medium text-right">Work</th>
                        <th className="px-3 py-2 font-medium text-right">Reward</th>
                        <th className="px-3 py-2 font-medium text-right">Tokens</th>
                        <th className="px-3 py-2 font-medium text-right">Jobs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim">
                      {loading && entries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-text-tertiary">Loading…</td>
                        </tr>
                      ) : (
                        entries.map((e) => (
                          <tr key={e.rank} className="hover:bg-bg-tertiary/40">
                            <td className="px-3 py-2 font-semibold text-text-primary">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${e.rank <= 3 ? "bg-accent-brand/10 text-accent-brand" : "bg-bg-tertiary text-text-secondary"}`}>
                                {e.rank}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-text-primary">{e.pseudonym}</td>
                            <td className="px-3 py-2 text-right font-semibold text-accent-green">{fmtUSD(e.earnings_micro_usd)}</td>
                            <td className="px-3 py-2 text-right text-text-secondary">{fmtUSD(e.work_earnings_micro_usd)}</td>
                            <td className="px-3 py-2 text-right text-text-tertiary">{fmtUSD(e.reward_earnings_micro_usd)}</td>
                            <td className="px-3 py-2 text-right text-text-primary">{fmtTokens(e.tokens)}</td>
                            <td className="px-3 py-2 text-right text-text-secondary">{e.jobs.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · proxy to <code className="rounded bg-bg-tertiary px-1">https://api.seedinfer.com/v1/leaderboard?metric=earnings&window=7d</code> · Coming soon: <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">docs.seedinfer.com</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

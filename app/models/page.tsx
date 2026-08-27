"use client"
import { useEffect, useState } from "react"
import Sidebar from "@/components/sidebar"
import ModelsCatalog from "@/components/models-catalog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cpu, ExternalLink, RefreshCw } from "lucide-react"
import { fetchStats } from "@/lib/api"
import type { ModelStat } from "@/lib/types"

export default function ModelsPage() {
  const [models, setModels] = useState<ModelStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<string>("")
  const [lastFetch, setLastFetch] = useState("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // Try GET /v1/models (requires auth) — will fail, fallback to /api/stats
      let fetched: ModelStat[] | null = null
      try {
        const r = await fetch("https://api.seedinfer.com/v1/models", { cache: "no-store" })
        if (r.ok) {
          const j = await r.json()
          // OpenAI models shape: { data: [{id}] } or { models: [...] }
          if (Array.isArray(j.data)) fetched = j.data.map((m: any) => ({ id: m.id, providers: m.providers ?? 0 }))
          else if (Array.isArray(j.models)) fetched = j.models
        } else {
          // auth error expected — fallback to stats
          throw new Error(`v1/models ${r.status}`)
        }
      } catch {
        // fallback to stats catalog
        const stats = await fetchStats(true)
        fetched = stats.models ?? []
        setRaw(JSON.stringify({ note: "GET /v1/models requires Bearer — using /api/stats catalog", models: fetched }, null, 2))
      }
      if (fetched) setModels(fetched)
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e?.message ?? "Failed")
      // final fallback
      try {
        const stats = await fetchStats(true)
        setModels(stats.models ?? [])
      } catch {}
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
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Models</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              GET /v1/models (auth) fallback to catalog from /api/stats · last fetch {lastFetch || "—"}
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
            <Card className="border border-accent-brand/20 bg-accent-brand/10">
              <CardContent className="p-3 flex items-start gap-2">
                <Cpu className="h-4 w-4 mt-0.5 shrink-0 text-accent-brand" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary">GET /v1/models — reuse models-catalog</div>
                  <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                    Upstream <code className="rounded bg-bg-tertiary px-1">GET https://api.seedinfer.com/v1/models</code> requires <code className="rounded bg-bg-tertiary px-1">Authorization: Bearer</code>. Without key
                    this page reuses <code className="rounded bg-bg-tertiary px-1">ModelsCatalog</code> from{" "}
                    <code className="rounded bg-bg-tertiary px-1">/api/stats</code> (1:1 parity). Future proxy:{" "}
                    <code className="rounded bg-bg-tertiary px-1">GET https://api.seedinfer.com/v1/models</code> →{" "}
                    <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-brand underline">
                      docs.seedinfer.com
                    </a>
                    .
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-accent-brand/20 bg-bg-secondary font-mono text-[10px]">
                  {models.length} models
                </Badge>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">{error}</div>
            )}

            <ModelsCatalog models={models} />

            {raw && (
              <Card className="border border-border-dim bg-bg-secondary">
                <CardContent className="p-3">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Raw (fallback to stats) — coming soon proxy to docs.seedinfer.com</div>
                  <pre className="max-h-[240px] overflow-auto rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-[11px] leading-4 text-text-secondary">{raw}</pre>
                </CardContent>
              </Card>
            )}

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · <code className="rounded bg-bg-tertiary px-1">GET /v1/models</code> (auth) fallback catalog via{" "}
              <code className="rounded bg-bg-tertiary px-1">/api/stats</code> · Coming soon — proxy to{" "}
              <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">
                docs.seedinfer.com
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

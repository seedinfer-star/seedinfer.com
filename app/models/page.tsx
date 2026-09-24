"use client"
import { useEffect, useState } from "react"
import Sidebar from "@/components/sidebar"
import ModelsCatalog from "@/components/models-catalog"
import { ExternalLink, RefreshCw, Layers, ShieldCheck } from "lucide-react"
import { fetchStats } from "@/lib/api"
import type { ModelStat } from "@/lib/types"

export default function ModelsPage() {
  const [models, setModels] = useState<ModelStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      let fetched: ModelStat[] | null = null
      try {
        const r = await fetch("https://seedinfer.com/api/v1/models", { cache: "no-store" })
        if (r.ok) {
          const j = await r.json()
          if (Array.isArray(j.data)) fetched = j.data.map((m: any) => ({ id: m.id, providers: m.providers ?? 1 }))
          else if (Array.isArray(j.models)) fetched = j.models
        }
      } catch {
        // Fallback to stats
      }

      if (!fetched || fetched.length === 0) {
        const stats = await fetchStats(true)
        fetched = stats.models ?? [{ id: "google/gemma-4-26b-a4b-nvfp4", providers: 1 }]
      }

      setModels(fetched)
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch models catalog")
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
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-text-primary">Models & Pricing Catalog</h1>
              <p className="font-mono text-[11px] text-text-tertiary">
                Hardware-attested P2P model deployments · Updated {lastFetch || "just now"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-accent-green/10 border border-accent-green/20 px-3 py-1 text-[11px] font-mono font-medium text-accent-green">
              <ShieldCheck className="h-3.5 w-3.5" /> End-to-end Encrypted & Attested
            </div>
            <a
              href="/api-console"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              API Console <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-6 sm:p-8">
            {error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
                {error}
              </div>
            )}

            <ModelsCatalog models={models} />

            <footer className="border-t border-border-dim pt-6 font-mono text-[11px] text-text-tertiary flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                SeedInfer P2P Network · <code className="rounded bg-bg-tertiary px-1.5 py-0.5">GET /api/v1/models</code>
              </div>
              <div className="flex items-center gap-3">
                <a href="/api-console" className="hover:text-text-secondary underline">OpenRouter Spec</a>
                <span>·</span>
                <a href="/provider" className="hover:text-text-secondary underline">Become a Provider</a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}

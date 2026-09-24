"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer } from "@/components/app-shell"
import ModelsCatalog from "@/components/models-catalog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cpu, Code2, FileText, RefreshCw } from "lucide-react"
import { fetchStats } from "@/lib/api"
import type { ModelStat } from "@/lib/types"
import { MODELS, API_BASE_URL } from "@/lib/catalog"

export default function ModelsPage() {
  const [models, setModels] = useState<ModelStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // Provider counts come from our own /api/stats; model list + prices come from lib/catalog
      const stats = await fetchStats(true)
      setModels(stats.models ?? [])
      setLastFetch(new Date().toLocaleTimeString())
    } catch (e: any) {
      setError(e?.message ?? "Network statistics unavailable.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <AppShell>
      <PageHeader
        title="Models"
        description={<>{MODELS.length} models · OpenAI-compatible at {API_BASE_URL} · updated {lastFetch || "—"}</>}
        actions={
          <>
            <Link
              href="/api-console"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <Code2 className="h-3.5 w-3.5" /> API Console
            </Link>
            <Link
              href="/docs"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <FileText className="h-3.5 w-3.5" /> Docs
            </Link>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </>
        }
      />
      <PageContainer>
            <Card className="border border-accent-brand/20 bg-accent-brand/10">
              <CardContent className="p-3 flex items-start gap-2">
                <Cpu className="h-4 w-4 mt-0.5 shrink-0 text-accent-brand" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary">List models via the API</div>
                  <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                    <code className="rounded bg-bg-tertiary px-1">GET {API_BASE_URL}/models</code> returns the same catalog in OpenAI format;{" "}
                    <code className="rounded bg-bg-tertiary px-1">GET {API_BASE_URL.replace("/v1", "/api/v1")}/pricing</code> returns per-token prices.
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-accent-brand/20 bg-bg-secondary font-mono text-[10px]">
                  {MODELS.length} models
                </Badge>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">{error}</div>
            )}

            <ModelsCatalog models={models} />

            <footer className="flex flex-col items-start justify-between gap-2 border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary sm:flex-row sm:items-center">
              <div>SeedInfer.com · Prices in USD per 1M tokens · Node counts from live network statistics</div>
              <div className="flex items-center gap-3">
                <Link href="/api-console" className="underline hover:text-text-secondary">API Console</Link>
                <span aria-hidden="true">·</span>
                <Link href="/provider" className="underline hover:text-text-secondary">Become a Provider</Link>
              </div>
            </footer>
      </PageContainer>
    </AppShell>
  )
}

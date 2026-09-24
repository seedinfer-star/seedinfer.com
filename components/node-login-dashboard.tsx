"use client"

import { useState, useEffect } from "react"
import { LIVE_MODEL, PROVIDER_ECONOMICS, REVENUE_SHARE_PCT } from "@/lib/catalog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { KeyRound, ShieldCheck, Activity, Cpu, Coins, RefreshCw, CheckCircle, AlertTriangle, LogOut } from "lucide-react"

export default function NodeLoginDashboard() {
  const [pubKey, setPubKey] = useState<string>("")
  const [inputKey, setInputKey] = useState<string>("")
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [nodeData, setNodeData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Read saved cookie on mount
  useEffect(() => {
    const cookies = document.cookie.split("; ")
    const cookiePub = cookies.find((c) => c.startsWith("seedinfer_provider_pubkey="))
    if (cookiePub) {
      const val = decodeURIComponent(cookiePub.split("=")[1])
      if (val) {
        setPubKey(val)
        setIsLoggedIn(true)
        fetchNodeStats(val)
      }
    }
  }, [])

  const fetchNodeStats = async (key: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/providers", { cache: "no-store" })
      const json = await res.json()
      const providers = json.data || []
      // Match by public_key or id
      const k = key.trim()
      const matched = providers.find((p: any) => {
        const pk = typeof p.public_key === "string" ? p.public_key.trim() : ""
        return p.id === k || (pk.length > 0 && (pk === k || pk.includes(k) || k.includes(pk)))
      })
      if (matched) {
        setNodeData(matched)
      } else {
        setNodeData(null)
        setError("No node with this key has sent a heartbeat yet. Start the agent and refresh in a minute.")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch node telemetry")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputKey.trim()) return

    let extractedKey = inputKey.trim()
    // Check if user pasted full seedinfer.env content
    if (extractedKey.includes("SEEDINFER_PUBLIC_KEY=")) {
      const match = extractedKey.match(/SEEDINFER_PUBLIC_KEY=([^\s"']+)/)
      if (match && match[1]) {
        extractedKey = match[1]
      }
    }

    // Save cookie for 1 year
    document.cookie = `seedinfer_provider_pubkey=${encodeURIComponent(extractedKey)}; path=/; max-age=31536000; SameSite=Strict`
    setPubKey(extractedKey)
    setIsLoggedIn(true)
    fetchNodeStats(extractedKey)
  }

  const handleLogout = () => {
    document.cookie = "seedinfer_provider_pubkey=; path=/; max-age=0"
    setPubKey("")
    setIsLoggedIn(false)
    setNodeData(null)
  }

  if (isLoggedIn && pubKey) {
    const totalTokens = nodeData?.tokens_generated || 0
    // Output tokens served × live output price × provider share + 30 days of standby retainer
    const estEarningsUSD = (
      (totalTokens / 1_000_000) * LIVE_MODEL.pricePer1M.output * PROVIDER_ECONOMICS.revenueShare +
      PROVIDER_ECONOMICS.standbyPerDayUsd * 30
    ).toFixed(2)
    const isHardwareMismatch = nodeData?.hardware_mismatch || false

    return (
      <Card className="border border-accent-brand/30 bg-gradient-to-r from-bg-secondary via-bg-tertiary/40 to-bg-secondary shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-brand/10 border border-accent-brand/20 text-accent-brand">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  Node Operator Dashboard
                  <Badge variant="success" className="font-mono text-[10px] gap-1">
                    <CheckCircle className="h-3 w-3" /> Key session
                  </Badge>
                </CardTitle>
                <div className="font-mono text-xs text-text-tertiary">
                  Public Key: <span className="text-text-primary">{pubKey.slice(0, 18)}...{pubKey.slice(-8)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchNodeStats(pubKey)} disabled={loading} className="gap-1.5 font-mono text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 font-mono text-xs text-text-tertiary hover:text-accent-red">
                <LogOut className="h-3.5 w-3.5" /> Disconnect
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-text-secondary">{error}</div>
          )}
          {isHardwareMismatch && (
            <div className="rounded-xl border border-accent-red/30 bg-accent-red/10 p-3.5 text-xs font-mono text-accent-red flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>HARDWARE MISMATCH WARNING:</strong> Your Ed25519 identity key is locked to a different GPU/host hardware fingerprint. Node requests are paused until re-bound to original hardware.
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border-dim bg-bg-primary/80 p-3.5">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-accent-green" /> Node Status
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${nodeData && !nodeData.stale ? "bg-accent-green animate-pulse" : "bg-text-tertiary"}`}
                  aria-hidden="true"
                />
                <span className="font-mono text-base font-semibold text-text-primary uppercase">
                  {nodeData ? (nodeData.stale ? "offline" : nodeData.status || "unknown") : "not found"}
                </span>
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-1">
                {nodeData?.chip || "—"} · {nodeData?.current_model || "—"}
              </div>
            </div>

            <div className="rounded-xl border border-border-dim bg-bg-primary/80 p-3.5">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-accent-brand" /> Avg TTFT (EWMA)
              </div>
              <div className="mt-1.5 font-mono text-base font-semibold text-text-primary">
                {nodeData?.ewmaTtft ? `${Number(nodeData.ewmaTtft).toFixed(1)} ms` : "—"}
              </div>
              <div className="font-mono text-[10px] text-accent-green mt-1">
                Measured by the gateway
              </div>
            </div>

            <div className="rounded-xl border border-border-dim bg-bg-primary/80 p-3.5">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-blue-400" /> Served Volume
              </div>
              <div className="mt-1.5 font-mono text-base font-semibold text-text-primary">
                {(nodeData?.requests_served || 0).toLocaleString()} reqs
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-1">
                {((nodeData?.tokens_generated || 0) / 1000).toFixed(1)}k tokens generated
              </div>
            </div>

            <div className="rounded-xl border border-border-dim bg-bg-primary/80 p-3.5">
              <div className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-accent-green" /> Est. Monthly Revenue
              </div>
              <div className="mt-1.5 font-mono text-base font-semibold text-accent-green">
                ${estEarningsUSD} USD
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-1">
                {REVENUE_SHARE_PCT}% of token revenue + ${PROVIDER_ECONOMICS.standbyPerDayUsd.toFixed(2)}/day standby
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border-dim bg-bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
          <KeyRound className="h-4 w-4 text-accent-brand" /> Zero-Account Node Quick Access
          <Badge variant="outline" className="ml-2 font-mono text-[10px]">
            Cookie Session
          </Badge>
        </CardTitle>
        <p className="font-mono text-xs text-text-tertiary">
          Paste your node&apos;s public key (<code className="rounded bg-bg-tertiary px-1 text-text-primary">SEEDINFER_PUBLIC_KEY</code> from{" "}
          <code className="rounded bg-bg-tertiary px-1 text-text-primary">seedinfer.env</code>) to see its status, TTFT and estimated earnings — no account needed.
          Never paste or share your private key.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="SEEDINFER_PUBLIC_KEY"
            aria-label="Node public key"
            className="flex-1 rounded-xl border border-border-default bg-bg-primary px-3.5 py-2 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-brand focus:outline-none"
          />
          <Button type="submit" className="bg-accent-brand font-mono text-xs text-white hover:bg-accent-brand-hover">
            Connect Node
          </Button>
        </form>
        {error && <div className="mt-2 font-mono text-xs text-accent-red">{error}</div>}
      </CardContent>
    </Card>
  )
}

"use client"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, ExternalLink, Wallet, Plus, CheckCircle2 } from "lucide-react"
import CryptoGateway from "@/components/billing/crypto-gateway"
import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

export default function BillingPage() {
  const [balanceCents, setBalanceCents] = useState<number>(0)
  const [balanceUsd, setBalanceUsd] = useState<number>(0)
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const gatewayRef = useRef<HTMLDivElement>(null)

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/credits", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      if (res.status === 401) {
        setIsAuthed(false)
        setBalanceCents(0)
        setBalanceUsd(0)
        setLoading(false)
        return
      }
      if (!res.ok) {
        // treat as unauth/zero but keep loading false
        setLoading(false)
        return
      }
      const data = await res.json().catch(() => ({}))
      if (typeof data.balance_usd_cents === "number") {
        setBalanceCents(Math.floor(data.balance_usd_cents))
        setBalanceUsd(typeof data.balance_usd === "number" ? data.balance_usd : data.balance_usd_cents / 100)
        setIsAuthed(true)
      } else {
        setBalanceCents(0)
        setBalanceUsd(0)
        setIsAuthed(true)
      }
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCredits()
    const id = setInterval(() => void fetchCredits(), 15000)
    return () => clearInterval(id)
  }, [fetchCredits])

  const scrollToGateway = () => {
    if (isAuthed === false) {
      router.push("/login?next=/billing")
      return
    }
    gatewayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    // fallback to id
    if (!gatewayRef.current) {
      document.getElementById("crypto-gateway")?.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Billing</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">Credits · usage · Crypto live · Stripe soon</p>
          </div>
          <a
            href="https://docs.seedinfer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            docs.seedinfer.com <ExternalLink className="h-3 w-3" />
          </a>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
            <Card className="border border-accent-green/20 bg-accent-green/10">
              <CardContent className="p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-accent-green" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary">Crypto live — pay-as-you-go $0.02/$0.05 per 1M + Stripe coming soon. 7 chains: ETH/Arb/Polygon/Base/BNB/HyperEVM/Solana → POST /api/v1/invoices → QR (EIP-681/Solana Pay) → worker 15s</div>
                  <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                    7 chains: ETH/Arb/Polygon/Base/BNB/HyperEVM/Solana →{" "}
                    <code className="rounded bg-bg-tertiary px-1">POST /api/v1/invoices</code> → QR (EIP-681/Solana Pay) → worker 15s
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-accent-green/20 bg-bg-secondary font-mono text-[10px]">Live · 7 chains</Badge>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border border-border-dim bg-bg-secondary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[13px]">
                    <Wallet className="h-4 w-4 text-accent-brand" />
                    Credits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Available credits</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
                      {loading ? <span className="font-mono text-lg text-text-tertiary">loading…</span> : `$${(balanceCents / 100).toFixed(2)}`}
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-tertiary">
                      {isAuthed === false ? (
                        <>
                          <a href="/login" className="font-semibold text-accent-brand underline hover:text-accent-brand-hover">
                            Sign in
                          </a>{" "}
                          to see balance — or{" "}
                          <a href="/register" className="font-semibold text-accent-brand underline hover:text-accent-brand-hover">
                            create account
                          </a>
                          . Unauth fallback shows $0.00.
                        </>
                      ) : (
                        <>Live balance from <code className="rounded bg-bg-tertiary px-1">GET /api/v1/credits</code> · poll 15s · worker credits on confirmed</>
                      )}
                    </div>
                    {!loading && isAuthed !== null && (
                      <div className="mt-1 font-mono text-[10px] text-text-tertiary">
                        balance_usd_cents: <code className="rounded bg-bg-tertiary px-1">{balanceCents}</code> · balance_usd:{" "}
                        <code className="rounded bg-bg-tertiary px-1">{balanceUsd.toFixed(2)}</code>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={scrollToGateway}>
                        <Plus className="mr-2 h-4 w-4" />
                        {isAuthed === false ? "Sign in to add credits" : "Add credits"}
                      </Button>
                      <Button variant="outline" onClick={scrollToGateway}>
                        {isAuthed === false ? "Sign in to view usage" : "View usage"}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wide text-text-primary">
                        Monthly Subscription Tiers
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                        Boosted API Usage
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          label: "GO",
                          price: "$1 / mo",
                          multiplier: "3x Value",
                          quota: "$3.00 API usage",
                          h5Limit: "max 40% per 5h ($1.20)",
                          weekLimit: "max 70% per 7d ($2.10)",
                          note: "For hobbyists and lightweight bots",
                        },
                        {
                          label: "GOAT",
                          price: "$5 / mo",
                          multiplier: "4x Value",
                          quota: "$20.00 API usage",
                          h5Limit: "max 15% per 5h ($3.00)",
                          weekLimit: "max 50% per 7d ($10.00)",
                          note: "For developers and micro-SaaS apps",
                        },
                        {
                          label: "PRO",
                          price: "$10 / mo",
                          multiplier: "5x Value",
                          quota: "$50.00 API usage",
                          h5Limit: "max 10% per 5h ($5.00)",
                          weekLimit: "max 40% per 7d ($20.00)",
                          note: "For professionals & high-volume scale",
                        },
                      ].map((p) => (
                        <div key={p.label} className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-text-primary">{p.label}</span>
                            <span className="rounded bg-accent-brand/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-brand">
                              {p.multiplier}
                            </span>
                          </div>
                          <div className="text-xl font-bold text-text-primary">{p.price}</div>
                          <div className="font-mono text-xs font-semibold text-accent-green">{p.quota}</div>
                          <div className="space-y-0.5 pt-1 font-mono text-[10px] text-text-secondary border-t border-border-dim">
                            <div>• 5h limit: <span className="text-text-primary">{p.h5Limit}</span></div>
                            <div>• 7d limit: <span className="text-text-primary">{p.weekLimit}</span></div>
                          </div>
                          <div className="font-mono text-[9px] text-text-tertiary pt-0.5">{p.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-text-tertiary">
                    100% of subscription payments feed the Global Revenue Pool and are settled with GPU providers via the Monthly Waterfall Model.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-3" ref={gatewayRef} id="crypto-gateway">
                <CryptoGateway />

                <Card className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                      <CreditCard className="h-3.5 w-3.5" />
                      Stripe — Coming soon
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs leading-4 text-text-secondary">
                    <p>card → credits → metered</p>
                    <p className="font-mono text-[11px]">Stripe publishable key: pk_test_… (placeholder)</p>
                    <div className="rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-2 font-mono text-[11px]">Stripe publishable key: pk_test_… (placeholder)</div>
                  </CardContent>
                </Card>

                <Card className="border border-border-dim bg-bg-secondary">
                  <CardContent className="p-3 font-mono text-[11px] leading-4 text-text-tertiary">
                    Docs proxy: <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">docs.seedinfer.com</a> · billing →{" "}
                    <code className="rounded bg-bg-tertiary px-1">POST /v1/checkout</code> +{" "}
                    <code className="rounded bg-bg-tertiary px-1">POST /api/v1/invoices</code> (Crypto live)
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Billing via Crypto (live) + Stripe (soon) — docs.seedinfer.com — proxy to{" "}
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

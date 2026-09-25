"use client"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer } from "@/components/app-shell"
import { LIVE_MODEL, PAYMENT_CHAINS, SOLANA_DEPOSIT_ADDRESS, MIN_INVOICE_CENTS, SUBSCRIPTION_PLANS, REVENUE_SHARE_PCT, centsToUsd, usd } from "@/lib/catalog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Wallet, Plus, CheckCircle2, Shield } from "lucide-react"
import CryptoGateway from "@/components/billing/crypto-gateway"
import EmailLink from "@/components/ui/email-link"
import type { ChainKey } from "@/lib/payments/chains"
import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

const pct = (f: number) => `${Number((f * 100).toFixed(1))}%`

export default function BillingContent({ allowedTokens }: { allowedTokens?: Partial<Record<ChainKey, string[]>> }) {
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
    if (!gatewayRef.current) {
      document.getElementById("crypto-gateway")?.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Credits · usage · crypto deposits"
        actions={
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <FileText className="h-3.5 w-3.5" /> Docs
          </Link>
        }
      />
      <PageContainer>
            <Card className="border border-accent-green/20 bg-accent-green/10">
              <CardContent className="p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-accent-green" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary">
                    Pay-as-you-go {usd(LIVE_MODEL.pricePer1M.input)} / {usd(LIVE_MODEL.pricePer1M.output)} per 1M tokens ({LIVE_MODEL.shortName}) — top up with crypto.
                  </div>
                  <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                    USDC or native tokens on {PAYMENT_CHAINS.filter((c) => c.key !== "solana" || SOLANA_DEPOSIT_ADDRESS).map((c) => c.name).join(", ")}
                    {SOLANA_DEPOSIT_ADDRESS ? "" : " · Solana deposits coming soon"}. Minimum invoice {MIN_INVOICE_CENTS}¢. Card payments are not available yet.
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-accent-green/20 bg-bg-secondary font-mono text-[10px]">Live · {SOLANA_DEPOSIT_ADDRESS ? 7 : 6} chains</Badge>
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
                          .
                        </>
                      ) : (
                        <>Live balance · refreshed every 15s · deposits are credited after confirmation</>
                      )}
                    </div>
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
                        Monthly subscription plans
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                        Pay once, get more usage
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {SUBSCRIPTION_PLANS.map((pl) => ({
                        label: pl.key,
                        price: `$${pl.priceCents / 100} / mo`,
                        multiplier: `${pl.multiplier}x value`,
                        quota: `${centsToUsd(pl.usageCents)} API usage`,
                        h5Limit: `max ${pct(pl.limit5h)} per 5h (${centsToUsd(pl.usageCents * pl.limit5h)})`,
                        weekLimit: `max ${pct(pl.limit7d)} per 7d (${centsToUsd(pl.usageCents * pl.limit7d)})`,
                        note: pl.note,
                      })).map((p) => (
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
                  <div className="space-y-1 rounded-xl border border-accent-amber/20 bg-accent-amber/10 p-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-accent-amber">
                      <Shield className="h-4 w-4 shrink-0" />
                      Dedicated subscription keys &amp; routing priority
                    </div>
                    <ul className="space-y-0.5 font-mono text-[11px] leading-4 text-text-secondary">
                      <li>
                        • <strong className="text-text-primary">Dedicated API keys:</strong> subscriptions issue separate keys starting with{" "}
                        <code className="rounded bg-bg-tertiary px-1 text-text-primary">sk_sub_...</code>; pay-as-you-go keys start with{" "}
                        <code className="rounded bg-bg-tertiary px-1 text-text-primary">sk_live_...</code>.
                      </li>
                      <li>
                        • <strong className="text-text-primary">Background priority:</strong> subscription requests are routed at the lowest priority (
                        <code className="rounded bg-bg-tertiary px-1 text-text-primary">X-SeedInfer-Priority: background</code>) so pay-as-you-go
                        latency is protected at peak demand, in exchange for {SUBSCRIPTION_PLANS[0].multiplier}x–
                        {SUBSCRIPTION_PLANS[SUBSCRIPTION_PLANS.length - 1].multiplier}x more usage.
                      </li>
                    </ul>
                  </div>
                  <p className="font-mono text-[10px] text-text-tertiary">
                    Plans are paid with the same crypto gateway. GPU providers receive {REVENUE_SHARE_PCT}% of the token revenue their nodes serve.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-3" ref={gatewayRef} id="crypto-gateway">
                <CryptoGateway allowedTokens={allowedTokens} />

                <Card className="border border-border-dim bg-bg-secondary">
                  <CardContent className="p-3 font-mono text-[11px] text-text-tertiary">
                    Need custom enterprise billing or bulk credits? Contact{" "}
                    <EmailLink user="support" className="text-accent-brand underline" />
                  </CardContent>
                </Card>
              </div>
            </div>
      </PageContainer>
    </AppShell>
  )
}
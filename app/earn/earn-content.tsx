"use client"

import AppShell from "@/components/app-shell"
import Calculator from "@/components/calculator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LIVE_MODEL, MIN_VRAM_GB, PROVIDER_ECONOMICS, REVENUE_SHARE_PCT, PROTOCOL_FEE_PCT, PAYOUT_LABEL } from "@/lib/catalog"
import { Coins, ExternalLink, CreditCard, Clock, Server, Terminal, Download, ArrowUpRight } from "lucide-react"

export default function EarnContent() {
  return (
    <AppShell>
        <header className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-border-dim bg-bg-secondary/60 px-4 py-2 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-text-primary flex items-center gap-2">
              <Coins className="h-4 w-4 text-accent-green" /> Earnings & Revenue Calculator
            </h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">Provider earnings · {REVENUE_SHARE_PCT}% revenue share · {PAYOUT_LABEL}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/provider"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover transition-colors"
            >
              Become a Provider <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="/docs"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
            
            {/* Interactive Provider Revenue & Net-Profit Calculator */}
            <Calculator />

            {/* Provider Quick Install Callout */}
            <Card className="border border-accent-brand/20 bg-accent-brand/10">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 shrink-0 text-accent-brand" />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">Become a provider — NVIDIA ≥{MIN_VRAM_GB}GB VRAM · {LIVE_MODEL.name} · CUDA 13.3</div>
                    <div className="mt-0.5 font-mono text-xs leading-4 text-text-secondary">
                      One-liner: <code className="rounded bg-bg-tertiary px-1">curl -fsSL https://seedinfer.com/install.sh | bash</code> — Ubuntu 24.04+ ·
                      driver 580+ (CUDA 13.3) · Docker + nvidia-container-toolkit ·{" "}
                      <a href="/provider" className="font-medium text-accent-brand underline">
                        /provider
                      </a>{" "}
                      + <code className="rounded bg-bg-tertiary px-1">/provider.tar.gz</code>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href="/provider"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover"
                  >
                    <Terminal className="h-3.5 w-3.5" /> Become a Provider
                  </a>
                  <a
                    href="/provider.tar.gz"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                  >
                    <Download className="h-3.5 w-3.5" /> provider.tar.gz
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Waterfall Settlement Engine */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border border-border-dim bg-bg-secondary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[13px]">
                    <Coins className="h-4 w-4 text-accent-green" />
                    How providers are paid
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-5 text-text-secondary">
                  <p>
                    Each node earns <strong className="text-text-primary">{REVENUE_SHARE_PCT}% of the token revenue it serves</strong> (SeedInfer keeps a {PROTOCOL_FEE_PCT}% protocol fee), plus a daily standby retainer. Balances are settled monthly:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <Clock className="h-3 w-3 text-accent-brand" /> 1. Standby retainer
                      </div>
                      <div className="mt-1 text-xs font-medium text-text-primary">${PROVIDER_ECONOMICS.standbyPerDayUsd.toFixed(2)} / day per node</div>
                      <div className="mt-1 font-mono text-[11px] text-text-secondary">Paid for each calendar day (UTC) in which the node had ≥{Math.round(PROVIDER_ECONOMICS.standbyMinUptime * 100)}% uptime. Days below the threshold earn no retainer.</div>
                    </div>
                    <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <Coins className="h-3 w-3 text-accent-green" /> 2. Revenue share
                      </div>
                      <div className="mt-1 text-xs font-medium text-text-primary">{REVENUE_SHARE_PCT}% of token revenue</div>
                      <div className="mt-1 font-mono text-[11px] text-text-secondary">Tokens your node serves × the model price × {PROVIDER_ECONOMICS.revenueShare}. Protocol fee: {PROTOCOL_FEE_PCT}%.</div>
                    </div>
                    <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <CreditCard className="h-3 w-3 text-accent-brand" /> 3. {PROVIDER_ECONOMICS.payoutAsset} payouts ({PROVIDER_ECONOMICS.payoutChain})
                      </div>
                      <div className="mt-1 text-xs font-medium text-text-primary">Monthly Settlements</div>
                      <div className="mt-1 font-mono text-[11px] text-text-secondary">Paid in {PROVIDER_ECONOMICS.payoutAsset} on {PROVIDER_ECONOMICS.payoutChain} only. Minimum ${PROVIDER_ECONOMICS.minPayoutUsd.toFixed(2)} — smaller balances carry over to the next month.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Card className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-mono uppercase tracking-wide text-text-tertiary">Payout method</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-3 font-mono text-xs text-text-secondary">
                      Payouts are tracked by your node&apos;s public key (Ed25519) — no account needed. {PROVIDER_ECONOMICS.payoutAsset} is sent on {PROVIDER_ECONOMICS.payoutChain} once per month.
                    </div>
                    <Button disabled className="w-full opacity-60">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Fiat payouts: not available
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Provider earnings · {PAYOUT_LABEL}
            </div>
          </div>
        </main>
    </AppShell>
  )
}

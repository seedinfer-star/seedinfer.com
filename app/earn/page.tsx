"use client"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Coins, ExternalLink, CreditCard, ShieldCheck, Clock, Server, Terminal, Download } from "lucide-react"

export default function EarnPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Earnings</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">Provider earnings · Stripe Connect · Coming soon</p>
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
            <Card className="border border-accent-brand/20 bg-accent-brand/10">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 shrink-0 text-accent-brand" />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">Become a Provider — RTX 5090 32GB · NVFP4 · 1M ctx · CUDA 13.3</div>
                    <div className="mt-0.5 font-mono text-xs leading-4 text-text-secondary">
                      One-liner: <code className="rounded bg-bg-tertiary px-1">curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey hskey-xxx</code> — Ubuntu 24.04+ ·
                      driver 580+ (CUDA 13.3 Blackwell) · Docker + nvidia-container-toolkit · 50GB HF cache ·{" "}
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

            <Card className="border border-amber-500/20 bg-amber-500/10">
              <CardContent className="p-3 flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary">Coming soon — proxy to docs.seedinfer.com</div>
                  <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                    Earnings payouts via Stripe Connect are under construction. This stub proxies future{" "}
                    <code className="rounded bg-bg-tertiary px-1">GET /v1/earnings</code> and{" "}
                    <code className="rounded bg-bg-tertiary px-1">POST /v1/payouts</code> to{" "}
                    <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-brand underline">
                      docs.seedinfer.com
                    </a>
                    . Currently showing informational stub.
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-500/20 bg-bg-secondary font-mono text-[10px]">
                  Coming soon
                </Badge>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border border-border-dim bg-bg-secondary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[13px]">
                    <Coins className="h-4 w-4 text-accent-green" />
                    Fair Waterfall Settlement Engine
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-5 text-text-secondary">
                  <p>
                    SeedInfer distributes network revenue through a transparent, fair waterfall engine. 100% of user token sales and subscription revenues flow directly into the <strong className="text-text-primary">Global Revenue Pool</strong> and are settled monthly:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <Clock className="h-3 w-3 text-accent-brand" /> 1. Power Baseline ($0.40/d)
                      </div>
                      <div className="mt-1 text-xs font-medium text-text-primary">Base Standby Retainer</div>
                      <div className="mt-1 font-mono text-[11px] text-text-secondary">$0.01667/h accrued after each completed hour on standby. Requires ≥50% uptime since node registration.</div>
                    </div>
                    <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <Coins className="h-3 w-3 text-accent-green" /> 2. Profit Share
                      </div>
                      <div className="mt-1 text-xs font-medium text-text-primary">Surplus Traffic Dividend</div>
                      <div className="mt-1 font-mono text-[11px] text-text-secondary">Remaining surplus after baseline retainers is distributed proportionally based on processed token volume and model weight.</div>
                    </div>
                    <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                        <CreditCard className="h-3 w-3 text-accent-brand" /> 3. USDC Payouts (Base)
                      </div>
                      <div className="mt-1 text-xs font-medium text-text-primary">Monthly Settlements</div>
                      <div className="mt-1 font-mono text-[11px] text-text-secondary">Automated payouts in USDC on Base. Minimum $1.00 USD (balances under $1.00 carry over to next month).</div>
                    </div>
                  </div>
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs">
                    <li>
                      Join the network with 1 command: <code className="rounded bg-bg-tertiary px-1">curl -fsSL https://seedinfer.com/install.sh | bash</code> (RTX 5090 32GB, CUDA 13.3).
                    </li>
                    <li>Hourly uptime metering begins immediately upon node connection.</li>
                    <li>Maintain ≥50% uptime during the cycle to qualify for the electricity coverage retainer ($0.40/day).</li>
                    <li>Receive automated monthly USDC payouts on Base network straight to your node's public key address.</li>
                  </ol>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Card className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-mono uppercase tracking-wide text-text-tertiary">Stripe Connect — Coming soon</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-3 font-mono text-xs text-text-secondary">
                      Connect your Stripe account to receive earnings. KYC, tax forms (W-8/W-9), and payout schedule configured via Stripe Dashboard.
                    </div>
                    <Button disabled className="w-full opacity-60">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Connect Stripe — Coming soon
                    </Button>
                    <p className="font-mono text-[10px] leading-3 text-text-tertiary">
                      Docs proxy: <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">docs.seedinfer.com</a> →
                      earnings & payouts. Stripe Connect onboarding will be at <code className="rounded bg-bg-tertiary px-1">/earn/connect</code>.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-border-dim bg-bg-secondary">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                      <Coins className="h-3 w-3" /> Snapshot
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                      <div className="rounded bg-bg-tertiary px-2 py-2">
                        <div className="text-text-tertiary">Input</div>
                        <div className="font-semibold text-text-primary">$0.02 / 1M</div>
                      </div>
                      <div className="rounded bg-bg-tertiary px-2 py-2">
                        <div className="text-text-tertiary">Output</div>
                        <div className="font-semibold text-text-primary">$0.05 / 1M</div>
                      </div>
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-text-tertiary">Model: seedinfer/nemotron-lightning-1m · 1M ctx · 2M KV · cache 60s free / 5min max</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Earnings via Stripe Connect · Coming soon — proxy to{" "}
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

"use client"
import Sidebar from "@/components/sidebar"
import Calculator from "@/components/calculator"
import { Calculator as CalculatorIcon, ArrowUpRight, Coins } from "lucide-react"

export default function CalculatorPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary flex items-center gap-2">
              <CalculatorIcon className="h-4 w-4 text-accent-brand" /> Provider Revenue & Net-Profit Calculator
            </h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              Real-World Hardware Economics · RTX 5090 32GB · Nemotron 3.5 vs Gemma 4 · Darkbloom Benchmarks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/earn"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <Coins className="h-3.5 w-3.5" /> Earnings
            </a>
            <a
              href="/provider"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover transition-colors"
            >
              Become a Provider <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-5">
            <Calculator />
          </div>
        </main>
      </div>
    </div>
  )
}

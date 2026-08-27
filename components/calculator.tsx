"use client"

import Link from "next/link"
import { Calculator as CalculatorIcon, Coins, Cpu, Zap } from "lucide-react"

export default function Calculator() {
  return (
    <section id="calculator" className="col-span-12 rounded-xl border border-border-dim bg-bg-secondary p-6">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">CALCULATOR · ≥32GB VRAM</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">Net-Profit Calculator</h2>
        <p className="mt-1.5 max-w-2xl font-mono text-xs leading-4 text-text-tertiary">
          Static inputs only — live profit requires verified metering. Adjust your rig specs; result shows refinement placeholder.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Inputs */}
        <div className="col-span-12 lg:col-span-7">
          <div className="space-y-5">
            {/* VRAM */}
            <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary">
                  <Cpu className="h-3.5 w-3.5 text-text-tertiary" /> VRAM
                </label>
                <span className="rounded bg-bg-secondary px-2 py-1 font-mono text-xs font-semibold text-text-primary">32 – 96 GB</span>
              </div>
              <div className="mt-3">
                <input
                  type="range"
                  min={32}
                  max={96}
                  defaultValue={32}
                  disabled
                  aria-label="VRAM slider"
                  className="h-2 w-full cursor-not-allowed appearance-none rounded-full bg-bg-tertiary accent-accent-brand disabled:opacity-60"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-text-tertiary">
                  <span>32 GB min</span>
                  <span>64 GB</span>
                  <span>96 GB max</span>
                </div>
              </div>
              <p className="mt-2 font-mono text-[11px] leading-3 text-text-tertiary">
                RTX 5090 32GB minimum · H100 80GB · Blackwell headroom static demo only
              </p>
            </div>

            {/* Electricity */}
            <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary">
                  <Zap className="h-3.5 w-3.5 text-text-tertiary" /> Electricity
                </label>
                <span className="rounded bg-bg-secondary px-2 py-1 font-mono text-xs font-semibold text-text-primary">$/kWh</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0.05}
                  max={0.4}
                  step={0.01}
                  defaultValue={0.15}
                  disabled
                  aria-label="Electricity cost slider"
                  className="h-2 w-full cursor-not-allowed appearance-none rounded-full bg-bg-tertiary accent-accent-brand disabled:opacity-60"
                />
                <input
                  type="number"
                  placeholder="0.15"
                  disabled
                  aria-label="Electricity cost input"
                  className="h-9 w-[96px] shrink-0 cursor-not-allowed rounded-lg border border-border-dim bg-bg-secondary px-3 font-mono text-xs text-text-tertiary opacity-60"
                />
              </div>
              <p className="mt-2 font-mono text-[11px] leading-3 text-text-tertiary">Dominant cost driver · local tariff required for live calc</p>
            </div>

            {/* Uptime */}
            <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary">
                  <Coins className="h-3.5 w-3.5 text-text-tertiary" /> Uptime
                </label>
                <span className="rounded bg-bg-secondary px-2 py-1 font-mono text-xs font-semibold text-text-primary">%</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={90}
                  disabled
                  aria-label="Uptime slider"
                  className="h-2 w-full cursor-not-allowed appearance-none rounded-full bg-bg-tertiary accent-accent-brand disabled:opacity-60"
                />
                <input
                  type="number"
                  placeholder="90"
                  disabled
                  aria-label="Uptime input"
                  className="h-9 w-[96px] shrink-0 cursor-not-allowed rounded-lg border border-border-dim bg-bg-secondary px-3 font-mono text-xs text-text-tertiary opacity-60"
                />
              </div>
              <p className="mt-2 font-mono text-[11px] leading-3 text-text-tertiary">Availability factor · metering pending</p>
            </div>

            <p className="font-mono text-[10px] leading-3 text-text-tertiary">
              Inputs are UI-only and disabled · no mock calculation is performed.
            </p>
          </div>
        </div>

        {/* Result */}
        <div className="col-span-12 lg:col-span-5">
          <div className="sticky top-6 rounded-xl border-2 border-accent-green/20 bg-bg-primary p-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
              <CalculatorIcon className="h-3.5 w-3.5" /> Estimated net profit
            </div>

            <div className="mt-4 flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-secondary px-6 py-10 text-center">
              <span className="font-mono text-xs text-text-tertiary">Element requires refinement</span>
              <span className="mt-1 max-w-[28ch] font-mono text-[11px] leading-4 text-text-tertiary">
                Live profit = (tokens × price × 60% share) − (power × tariff × uptime) · metering not yet connected
              </span>
            </div>

            <Link
              href="/provider"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-accent-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-brand/90"
            >
              Check eligibility → /provider
            </Link>

            <p className="mt-2 text-center font-mono text-[10px] leading-3 text-text-tertiary">
              ≥32GB VRAM required · see economics threshold above
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

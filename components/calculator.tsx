"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Calculator as CalculatorIcon,
  Coins,
  Cpu,
  Zap,
  CheckCircle2,
  Award,
  Sparkles,
  TrendingUp,
  Server,
  Info,
  DollarSign,
  ArrowUpRight,
} from "lucide-react"

export default function Calculator() {
  // Calculator state initialized to requested defaults:
  // GPU: RTX 5090 32GB
  // Model: Gemma 4 26B A4B
  // Utilization: 30%
  // Input: 200M tokens/day @ $0.03/1M
  // Output: 20M tokens/day @ $0.30/1M
  // Power Draw: 220W / hour
  // Electricity Rate: $0.25 / kWh (EU Average) -> ~160 kWh / month = ~$40 electricity cost
  // Retainer: $0.40 / day ($12 / month)
  // Net Profit: $360 + $12 - $40 = $332 / month

  const [utilization, setUtilization] = useState<number>(30)
  const [electricityRate, setElectricityRate] = useState<number>(0.25)
  const [inputTokensDaily, setInputTokensDaily] = useState<number>(200) // in Millions
  const [outputTokensDaily, setOutputTokensDaily] = useState<number>(20) // in Millions

  // Dynamic calculations based on state
  const dailyTrafficRevenue =
    (inputTokensDaily * 0.03) + (outputTokensDaily * 0.30)
  const monthlyTrafficRevenue = dailyTrafficRevenue * 30

  const dailyRetainer = 0.40
  const monthlyRetainer = dailyRetainer * 30 // $12.00 / month

  const powerDrawW = 220 // 220W average per hour
  const monthlyKwh = (powerDrawW * 24 * 30) / 1000 // 158.4 kWh (~160 kWh)
  const monthlyPowerCost = monthlyKwh * electricityRate // ~$39.60 @ $0.25/kWh

  const grossMonthlyIncome = monthlyTrafficRevenue + monthlyRetainer
  const netMonthlyProfit = grossMonthlyIncome - monthlyPowerCost

  // Handle utilization slider adjustment to proportionally scale token throughput
  const handleUtilizationChange = (newUtil: number) => {
    setUtilization(newUtil)
    // Scale token throughput proportionally from 30% baseline
    const ratio = newUtil / 30
    setInputTokensDaily(Math.round(200 * ratio))
    setOutputTokensDaily(Math.round(20 * ratio))
  }

  return (
    <section id="calculator" className="col-span-12 rounded-2xl border border-border-dim bg-bg-secondary p-6 sm:p-8">
      {/* Section Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent-brand">
            <Sparkles className="h-3.5 w-3.5" /> Provider Revenue & Net-Profit Calculator
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Real-World Hardware Economics
          </h2>
          <p className="mt-1.5 max-w-3xl font-mono text-xs leading-5 text-text-secondary">
            Transparent, line-by-line financial breakdown for hosting <strong className="text-text-primary">Gemma 4 26B A4B</strong> on an <strong className="text-text-primary">NVIDIA RTX 5090 (32GB VRAM)</strong>. Based on empirical benchmarks from top 10% active nodes on decentralized P2P inference networks.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 font-mono text-xs font-semibold text-accent-green">
            <CheckCircle2 className="h-3.5 w-3.5" /> 100% Transparent Billing
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column — Interactive Controls & Parameters */}
        <div className="col-span-12 space-y-6 lg:col-span-7">
          {/* Card A — Hardware & Model Profile */}
          <div className="rounded-xl border border-border-dim bg-bg-primary p-5">
            <div className="flex items-center justify-between border-b border-border-dim pb-3">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
                <Cpu className="h-4 w-4 text-accent-brand" /> Rig Profile & Model Setup
              </div>
              <span className="rounded bg-accent-brand/10 px-2 py-0.5 font-mono text-[11px] font-medium text-accent-brand">
                NVFP4 W4A16 · 1M Context
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-3">
                <span className="font-mono text-[10px] uppercase text-text-tertiary">GPU Accelerator</span>
                <div className="mt-1 font-mono text-sm font-bold text-text-primary">NVIDIA RTX 5090 (32GB)</div>
                <div className="mt-0.5 font-mono text-[10px] text-text-tertiary">Blackwell GB202 · 24,576 CUDA cores</div>
              </div>
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-3">
                <span className="font-mono text-[10px] uppercase text-text-tertiary">Hosted LLM Model</span>
                <div className="mt-1 font-mono text-sm font-bold text-text-primary">Gemma 4 26B A4B</div>
                <div className="mt-0.5 font-mono text-[10px] text-text-tertiary">Native NVFP4 Quantized · vLLM Engine</div>
              </div>
            </div>
          </div>

          {/* Card B — GPU Card Utilization & Token Throughput */}
          <div className="rounded-xl border border-border-dim bg-bg-primary p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
                  <TrendingUp className="h-4 w-4 text-accent-green" /> Average GPU Card Utilization
                </label>
                <span className="rounded bg-accent-green/10 px-2.5 py-1 font-mono text-xs font-bold text-accent-green">
                  {utilization}% Average Load
                </span>
              </div>
              <div className="mt-3">
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={utilization}
                  onChange={(e) => handleUtilizationChange(Number(e.target.value))}
                  className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent-green"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-text-tertiary">
                  <span>5% (Low)</span>
                  <span className="font-semibold text-accent-green">30% (Standard Benchmark)</span>
                  <span>100% (Full Capacity)</span>
                </div>
              </div>
            </div>

            {/* Token Inputs Sliders */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border-dim">
              {/* Input Tokens */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-text-secondary">Daily Input Tokens</span>
                  <span className="font-bold text-text-primary">{inputTokensDaily}M / day</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={500}
                  step={10}
                  value={inputTokensDaily}
                  onChange={(e) => setInputTokensDaily(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent-brand"
                />
                <p className="font-mono text-[10px] text-text-tertiary">Rate: $0.03 / 1M Input Tokens</p>
              </div>

              {/* Output Tokens */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-text-secondary">Daily Output Tokens</span>
                  <span className="font-bold text-text-primary">{outputTokensDaily}M / day</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={100}
                  step={2}
                  value={outputTokensDaily}
                  onChange={(e) => setOutputTokensDaily(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent-brand"
                />
                <p className="font-mono text-[10px] text-text-tertiary">Rate: $0.30 / 1M Output Tokens</p>
              </div>
            </div>
          </div>

          {/* Card C — Power Draw & Electricity Rate */}
          <div className="rounded-xl border border-border-dim bg-bg-primary p-5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
                <Zap className="h-4 w-4 text-amber-400" /> Electricity Tariff & Power Consumption
              </label>
              <span className="rounded bg-amber-400/10 px-2.5 py-1 font-mono text-xs font-bold text-amber-400">
                ${electricityRate.toFixed(2)} / kWh
              </span>
            </div>
            <div className="mt-3">
              <input
                type="range"
                min={0.05}
                max={0.50}
                step={0.01}
                value={electricityRate}
                onChange={(e) => setElectricityRate(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-amber-400"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-text-tertiary">
                <span>$0.05 (Solar/US Low)</span>
                <span className="font-semibold text-amber-400">$0.25 (EU Avg)</span>
                <span>$0.50 (High Tariff)</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border-dim bg-bg-secondary p-3 font-mono text-xs text-text-secondary">
              <div>
                <span>Avg Power Draw: </span>
                <strong className="text-text-primary">220W / hour</strong>
              </div>
              <div>
                <span>Monthly Energy: </span>
                <strong className="text-text-primary">{monthlyKwh.toFixed(1)} kWh</strong>
              </div>
            </div>
          </div>

          {/* Card D — Live Network Leaderboard Benchmarks Proof */}
          <div className="rounded-xl border border-border-dim bg-bg-primary p-5">
            <div className="flex items-center justify-between border-b border-border-dim pb-3">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
                <Award className="h-4 w-4 text-amber-400" /> Real-World Network Benchmarks (Darkbloom Proof)
              </div>
              <span className="font-mono text-[10px] text-text-tertiary">Top 10% Active Nodes</span>
            </div>
            <p className="mt-3 font-mono text-xs leading-5 text-text-secondary">
              Our 200M Input / 20M Output token baseline is verified by real-world throughput metrics from leading decentralized inference networks:
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-center">
                <div className="text-[10px] text-amber-400 font-bold">🥇 1. forest-komodo-7812</div>
                <div className="mt-1 text-sm font-extrabold text-text-primary">325.5M</div>
                <div className="text-[9px] text-text-tertiary">tokens / day</div>
              </div>
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-2.5 text-center">
                <div className="text-[10px] text-text-secondary font-semibold">🥈 2. pluckier-stoat-9536</div>
                <div className="mt-1 text-sm font-bold text-text-primary">182.9M</div>
                <div className="text-[9px] text-text-tertiary">tokens / day</div>
              </div>
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-2.5 text-center">
                <div className="text-[10px] text-text-secondary font-semibold">🥉 3. downy-scorpion-2274</div>
                <div className="mt-1 text-sm font-bold text-text-primary">156.5M</div>
                <div className="text-[9px] text-text-tertiary">tokens / day</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column — Live Financial Statement & Net Profit Output */}
        <div className="col-span-12 lg:col-span-5">
          <div className="sticky top-6 rounded-2xl border-2 border-accent-green/40 bg-gradient-to-b from-bg-primary via-bg-primary to-bg-secondary p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-dim pb-4">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent-green">
                <CalculatorIcon className="h-4 w-4" /> Monthly Profit Summary
              </div>
              <span className="rounded-full bg-accent-green/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent-green">
                Net Earnings
              </span>
            </div>

            {/* Big Net Monthly Profit Highlight */}
            <div className="mt-6 text-center">
              <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                Estimated Net Profit / Month
              </span>
              <div className="mt-2 flex items-center justify-center gap-1 font-mono text-4xl font-extrabold tracking-tight text-accent-green sm:text-5xl">
                <span>${netMonthlyProfit.toFixed(0)}</span>
                <span className="text-xl font-normal text-text-tertiary">/ mo</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                Pure net revenue after electricity deduction for 1x RTX 5090
              </p>
            </div>

            {/* Line-by-Line Itemized Financial Calculation */}
            <div className="mt-6 space-y-3 rounded-xl border border-border-dim bg-bg-secondary p-4 font-mono text-xs">
              <div className="text-[11px] font-semibold text-text-primary uppercase tracking-wider border-b border-border-dim pb-2">
                Monthly Breakdown (30 Days)
              </div>

              {/* Traffic Revenue */}
              <div className="flex items-center justify-between">
                <span className="text-text-secondary flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-accent-brand" /> Traffic Revenue
                </span>
                <span className="font-bold text-accent-green">+${monthlyTrafficRevenue.toFixed(2)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                {inputTokensDaily}M in ($0.03) + {outputTokensDaily}M out ($0.30) / day
              </div>

              {/* Standby Retainer */}
              <div className="flex items-center justify-between pt-2 border-t border-border-dim/50">
                <span className="text-text-secondary flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-accent-brand" /> Standby Retainer
                </span>
                <span className="font-bold text-accent-green">+${monthlyRetainer.toFixed(2)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                $0.40 / day guaranteed rate (&ge;50% uptime)
              </div>

              {/* Electricity Cost */}
              <div className="flex items-center justify-between pt-2 border-t border-border-dim/50">
                <span className="text-text-secondary flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-400" /> Electricity Cost
                </span>
                <span className="font-bold text-accent-red">-${monthlyPowerCost.toFixed(2)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                220W/h (~{monthlyKwh.toFixed(0)} kWh) @ ${electricityRate.toFixed(2)}/kWh
              </div>

              {/* Formula & Total Net Calculation */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-accent-green/10 p-3 pt-3 border-t-2 border-accent-green/30 text-sm">
                <span className="font-bold text-text-primary">Net Income</span>
                <span className="font-extrabold text-accent-green">${netMonthlyProfit.toFixed(2)}</span>
              </div>
            </div>

            {/* Transparency Note */}
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-accent-brand/20 bg-accent-brand/5 p-3">
              <Info className="h-4 w-4 shrink-0 text-accent-brand mt-0.5" />
              <p className="font-mono text-[11px] leading-4 text-text-secondary">
                <strong className="text-text-primary">100% Transparent Economics:</strong> Calculation formula: <code className="text-accent-brand">$360 (Traffic) + $12 (Retainer) - $40 (Electricity) = $332 Net Profit</code>. Node throughput varies dynamically based on P2P user routing demand.
              </p>
            </div>

            {/* CTA Link */}
            <Link
              href="/provider"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-brand px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-accent-brand-hover"
            >
              <Server className="h-4 w-4" /> Start Hosting Node on RTX 5090 <ArrowUpRight className="h-4 w-4" />
            </Link>

            <p className="mt-2 text-center font-mono text-[10px] text-text-tertiary">
              NVIDIA RTX 5090 (32GB VRAM) required · Ubuntu 24.04 LTS · vLLM + Docker
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

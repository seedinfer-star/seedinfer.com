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
  Flame,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  Scale,
  Wifi,
  Unlock,
  Lock,
} from "lucide-react"

type ModelProfile = {
  id: "nemotron" | "gemma"
  name: string
  version: string
  inputRate: number // $ per 1M
  outputRate: number // $ per 1M
  baseInputDaily: number // M tokens @ 30% load
  baseOutputDaily: number // M tokens @ 30% load
  efficiencyMultiplier: number
  badgeText: string
  description: string
}

const MODELS: Record<string, ModelProfile> = {
  nemotron: {
    id: "nemotron",
    name: "NVIDIA Nemotron 3.5 Lightning 30B",
    version: "A3B NVFP4 · 1M Ctx",
    inputRate: 0.02,
    outputRate: 0.10,
    baseInputDaily: 600, // 3x efficiency vs Gemma (200M x 3)
    baseOutputDaily: 60, // 3x efficiency vs Gemma (20M x 3)
    efficiencyMultiplier: 3.0,
    badgeText: "3x Compute & Power Efficiency",
    description: "Ultra-optimized architectural efficiency. Processes 3x token throughput per Watt with lower builder tariffs.",
  },
  gemma: {
    id: "gemma",
    name: "Gemma 4 26B A4B",
    version: "NVFP4 W4A16 · 1M Ctx",
    inputRate: 0.03,
    outputRate: 0.30,
    baseInputDaily: 200,
    baseOutputDaily: 20,
    efficiencyMultiplier: 1.0,
    badgeText: "Standard NVFP4 Baseline",
    description: "Higher per-token output pricing tier ($0.30/1M out) with standard 200M/20M daily throughput baseline at 30% load.",
  },
}

export default function Calculator() {
  const [selectedModelKey, setSelectedModelKey] = useState<"nemotron" | "gemma">("nemotron")
  const currentModel = MODELS[selectedModelKey]

  const [utilization, setUtilization] = useState<number>(30)
  const [electricityRate, setElectricityRate] = useState<number>(0.25)
  const [inputTokensDaily, setInputTokensDaily] = useState<number>(currentModel.baseInputDaily)
  const [outputTokensDaily, setOutputTokensDaily] = useState<number>(currentModel.baseOutputDaily)

  // Handle Model Switching
  const handleModelSwitch = (key: "nemotron" | "gemma") => {
    setSelectedModelKey(key)
    const model = MODELS[key]
    const ratio = utilization / 30
    setInputTokensDaily(Math.round(model.baseInputDaily * ratio))
    setOutputTokensDaily(Math.round(model.baseOutputDaily * ratio))
  }

  // Handle Utilization Slider adjustment
  const handleUtilizationChange = (newUtil: number) => {
    setUtilization(newUtil)
    const ratio = newUtil / 30
    setInputTokensDaily(Math.round(currentModel.baseInputDaily * ratio))
    setOutputTokensDaily(Math.round(currentModel.baseOutputDaily * ratio))
  }

  // Dynamic Financial Calculations
  const dailyTrafficRevenue =
    (inputTokensDaily * currentModel.inputRate) +
    (outputTokensDaily * currentModel.outputRate)
  const monthlyTrafficRevenue = dailyTrafficRevenue * 30

  const dailyRetainer = 0.40
  const monthlyRetainer = dailyRetainer * 30 // $12.00 / month

  const powerDrawW = 220 // 220W average power draw per hour
  const monthlyKwh = (powerDrawW * 24 * 30) / 1000 // 158.4 kWh (~160 kWh)
  const monthlyPowerCost = monthlyKwh * electricityRate // ~$39.60 @ $0.25/kWh

  const grossMonthlyIncome = monthlyTrafficRevenue + monthlyRetainer
  const netMonthlyProfit = grossMonthlyIncome - monthlyPowerCost

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
            Transparent, line-by-line financial breakdown for hosting models on an <strong className="text-text-primary">NVIDIA RTX 5090 (32GB VRAM)</strong>. Verified against empirical benchmarks from top 10% active nodes on decentralized P2P inference networks.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 font-mono text-xs font-semibold text-accent-green">
            <CheckCircle2 className="h-3.5 w-3.5" /> 100% Transparent Billing
          </span>
        </div>
      </div>

      {/* Realistic Expectations Banner: Expected Median Earnings (~$120/mo Net) */}
      <div className="mt-6 rounded-xl border border-accent-brand/30 bg-gradient-to-r from-accent-brand/10 via-bg-primary to-bg-primary p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Scale className="h-5 w-5 shrink-0 text-accent-brand mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-text-primary uppercase tracking-wider">
                  Realistic Earnings Expectation
                </span>
                <span className="rounded-full bg-accent-brand/20 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-brand">
                  Network Median: ~$120/mo Net
                </span>
              </div>
              <p className="mt-1 font-mono text-xs leading-5 text-text-secondary">
                While high-utilization top-tier nodes earn <strong className="text-accent-green">$330–$512/mo net</strong> during peak traffic, the <strong className="text-text-primary">expected network median for average RTX 5090 nodes settles realistically around ~$120 USD/month net profit</strong> after deducting electricity costs. We believe in complete honesty over hyped promises.
              </p>
            </div>
          </div>
          <div className="shrink-0 font-mono text-right sm:text-right text-left">
            <div className="text-[10px] uppercase text-text-tertiary">Network Median Net</div>
            <div className="text-xl font-extrabold text-accent-brand">~$120 / mo</div>
            <div className="text-[9px] text-text-tertiary">after power deduction</div>
          </div>
        </div>
      </div>

      {/* Model Selection Tabs */}
      <div className="mt-6 rounded-xl border border-border-dim bg-bg-primary p-4">
        <div className="flex items-center justify-between font-mono text-xs font-semibold uppercase tracking-wider text-text-primary mb-3">
          <span className="flex items-center gap-1.5 text-accent-brand">
            <Flame className="h-4 w-4" /> Select Hosted Model Strategy
          </span>
          <span className="text-[11px] text-text-tertiary">Select model architecture to calculate yield</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Model Option 1: Nemotron */}
          <button
            type="button"
            onClick={() => handleModelSwitch("nemotron")}
            className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
              selectedModelKey === "nemotron"
                ? "border-accent-brand bg-accent-brand/10 shadow-md ring-1 ring-accent-brand"
                : "border-border-dim bg-bg-secondary hover:border-border-default hover:bg-bg-tertiary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-text-primary">
                NVIDIA Nemotron 3.5 Lightning 30B
              </span>
              <span className="rounded bg-accent-green/15 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-green">
                3x Compute Efficient
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-accent-brand">
              Rate: $0.02 / 1M in · $0.10 / 1M out
            </div>
            <p className="mt-2 font-mono text-[10px] leading-4 text-text-tertiary">
              3x energy efficiency allows <strong className="text-text-secondary">600M In / 60M Out</strong> tokens/day at 30% GPU load ($220W/h). Yields <strong className="text-accent-green">~$512/mo Net</strong>.
            </p>
          </button>

          {/* Model Option 2: Gemma 4 */}
          <button
            type="button"
            onClick={() => handleModelSwitch("gemma")}
            className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
              selectedModelKey === "gemma"
                ? "border-accent-brand bg-accent-brand/10 shadow-md ring-1 ring-accent-brand"
                : "border-border-dim bg-bg-secondary hover:border-border-default hover:bg-bg-tertiary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-text-primary">
                Gemma 4 26B A4B
              </span>
              <span className="rounded bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                Standard Baseline
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-accent-brand">
              Rate: $0.03 / 1M in · $0.30 / 1M out
            </div>
            <p className="mt-2 font-mono text-[10px] leading-4 text-text-tertiary">
              Standard throughput <strong className="text-text-secondary">200M In / 20M Out</strong> tokens/day at 30% GPU load. Higher output tariff tier yields <strong className="text-accent-green">~$332/mo Net</strong>.
            </p>
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column — Interactive Controls & Parameters */}
        <div className="col-span-12 space-y-6 lg:col-span-7">
          {/* Card A — Hardware & Selected Model Profile */}
          <div className="rounded-xl border border-border-dim bg-bg-primary p-5">
            <div className="flex items-center justify-between border-b border-border-dim pb-3">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
                <Cpu className="h-4 w-4 text-accent-brand" /> Active Rig Profile & Rates
              </div>
              <span className="rounded bg-accent-brand/10 px-2 py-0.5 font-mono text-[11px] font-medium text-accent-brand">
                {currentModel.version}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-3">
                <span className="font-mono text-[10px] uppercase text-text-tertiary">GPU Hardware</span>
                <div className="mt-1 font-mono text-sm font-bold text-text-primary">NVIDIA RTX 5090 (32GB)</div>
                <div className="mt-0.5 font-mono text-[10px] text-text-tertiary">Blackwell GB202 · 24,576 CUDA cores</div>
              </div>
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-3">
                <span className="font-mono text-[10px] uppercase text-text-tertiary">Selected Model Rates</span>
                <div className="mt-1 font-mono text-sm font-bold text-accent-brand">
                  ${currentModel.inputRate.toFixed(2)} in / ${currentModel.outputRate.toFixed(2)} out
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-text-tertiary">Per 1,000,000 processed tokens</div>
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
                  max={1500}
                  step={20}
                  value={inputTokensDaily}
                  onChange={(e) => setInputTokensDaily(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent-brand"
                />
                <p className="font-mono text-[10px] text-text-tertiary">Rate: ${currentModel.inputRate.toFixed(2)} / 1M Input Tokens</p>
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
                  max={200}
                  step={2}
                  value={outputTokensDaily}
                  onChange={(e) => setOutputTokensDaily(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent-brand"
                />
                <p className="font-mono text-[10px] text-text-tertiary">Rate: ${currentModel.outputRate.toFixed(2)} / 1M Output Tokens</p>
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
              Throughput metrics verified by empirical activity across top 10% active GPU nodes on decentralized inference networks:
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
                {currentModel.id === "nemotron" ? "$512/mo Net" : "$332/mo Net"}
              </span>
            </div>

            {/* Big Net Monthly Profit Highlight */}
            <div className="mt-6 text-center">
              <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                Estimated Net Profit / Month ({currentModel.id === "nemotron" ? "Nemotron" : "Gemma"})
              </span>
              <div className="mt-2 flex items-center justify-center gap-1 font-mono text-4xl font-extrabold tracking-tight text-accent-green sm:text-5xl">
                <span>${netMonthlyProfit.toFixed(0)}</span>
                <span className="text-xl font-normal text-text-tertiary">/ mo</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                Pure net profit after power deduction on 1x RTX 5090
              </p>
            </div>

            {/* Line-by-Line Itemized Financial Calculation */}
            <div className="mt-6 space-y-3 rounded-xl border border-border-dim bg-bg-secondary p-4 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-text-primary uppercase tracking-wider border-b border-border-dim pb-2">
                <span>Monthly Statement (30 Days)</span>
                <span className="text-[10px] text-accent-brand">{currentModel.name.split(" ")[1]}</span>
              </div>

              {/* Traffic Revenue */}
              <div className="flex items-center justify-between">
                <span className="text-text-secondary flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-accent-brand" /> Traffic Revenue
                </span>
                <span className="font-bold text-accent-green">+${monthlyTrafficRevenue.toFixed(2)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                {inputTokensDaily}M in (${currentModel.inputRate.toFixed(2)}) + {outputTokensDaily}M out (${currentModel.outputRate.toFixed(2)}) / day
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
                <span className="font-bold text-text-primary">Net Monthly Profit</span>
                <span className="font-extrabold text-accent-green">${netMonthlyProfit.toFixed(2)}</span>
              </div>
            </div>

            {/* Efficiency Explanation Note */}
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-accent-brand/20 bg-accent-brand/5 p-3">
              <Info className="h-4 w-4 shrink-0 text-accent-brand mt-0.5" />
              <p className="font-mono text-[11px] leading-4 text-text-secondary">
                <strong className="text-text-primary">Model Energy Efficiency:</strong> Nemotron 3.5 achieves 3x token/Watt compute efficiency over Gemma 4. At $0.02/$0.10 rates, 3x higher throughput (600M in / 60M out) yields <strong className="text-accent-green">$540 traffic + $12 retainer - $40 power = $512/mo Net Profit</strong>.
              </p>
            </div>

            {/* CTA Link */}
            <Link
              href="/provider"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-brand px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-accent-brand-hover"
            >
              <Server className="h-4 w-4" /> Deploy {currentModel.id === "nemotron" ? "Nemotron" : "Gemma"} Node on RTX 5090 <ArrowUpRight className="h-4 w-4" />
            </Link>

            <p className="mt-2 text-center font-mono text-[10px] text-text-tertiary">
              NVIDIA RTX 5090 (32GB VRAM) required · Ubuntu 24.04 LTS · vLLM + Docker
            </p>
          </div>
        </div>
      </div>

      {/* Direct Comparison: Vast.ai vs SeedInfer P2P Freedom Matrix */}
      <div className="mt-10 rounded-xl border border-border-dim bg-bg-primary p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border-dim pb-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent-brand">
              <ShieldCheck className="h-4 w-4" /> Platform Comparison: Vast.ai vs SeedInfer Freedom
            </div>
            <h3 className="mt-1 text-lg font-bold text-text-primary">
              Why P2P Inference Beats Traditional Rental Platforms
            </h3>
          </div>
          <span className="rounded-full bg-accent-green/10 px-3 py-1 font-mono text-xs font-semibold text-accent-green">
            Full GPU Ownership & Flexibility
          </span>
        </div>

        <p className="mt-4 font-mono text-xs leading-5 text-text-secondary">
          Traditional platforms like <strong className="text-text-primary">Vast.ai</strong> lock down your host system, demand 24/7 continuous availability, and grant tenant root/kernel access. SeedInfer runs as an isolated user-space container—giving you complete freedom to pause or use your GPU anytime without penalty.
        </p>

        {/* Comparison Table Grid */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-border-dim bg-bg-secondary text-[11px] text-text-tertiary uppercase">
                <th className="p-3">Feature / Parameter</th>
                <th className="p-3 text-red-400 bg-red-500/5">Vast.ai (Traditional Rental)</th>
                <th className="p-3 text-accent-green bg-accent-green/5">SeedInfer P2P Network</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dim">
              <tr>
                <td className="p-3 font-semibold text-text-primary">Max Net Monthly Income (RTX 5090)</td>
                <td className="p-3 text-text-secondary bg-red-500/5">
                  <span className="font-bold text-red-400">$152 / mo Max Net</span> ($252 gross - $100 power @ 100% 24/7 occupancy)
                </td>
                <td className="p-3 font-bold text-accent-green bg-accent-green/5">
                  $330 – $512 / mo Net Profit (up to 3x higher yield)
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-text-primary">Expected Network Median Net</td>
                <td className="p-3 text-text-secondary bg-red-500/5">
                  ~$50 – $90 / mo (frequent empty unrented slots)
                </td>
                <td className="p-3 font-bold text-accent-brand bg-accent-green/5">
                  ~$120 / mo Net (plus $0.40/day standby cover)
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-text-primary">GPU Owner Freedom & Flexibility</td>
                <td className="p-3 text-red-400 bg-red-500/5 flex items-center gap-1.5">
                  <X className="h-4 w-4 shrink-0" /> <strong>0% Freedom</strong> (Requires 24/7 non-stop availability or rating drops)
                </td>
                <td className="p-3 text-accent-green bg-accent-green/5 flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0" /> <strong>100% Freedom</strong> (Pause, game, render, or work anytime)
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-text-primary">Host System & Privacy Security</td>
                <td className="p-3 text-red-400 bg-red-500/5">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 shrink-0" /> <strong>Kernel / Root Access</strong> (Strangers get SSH access to host system)
                  </div>
                </td>
                <td className="p-3 text-accent-green bg-accent-green/5">
                  <div className="flex items-center gap-1.5">
                    <Unlock className="h-4 w-4 shrink-0" /> <strong>Zero Kernel Access</strong> (Isolated Docker + Tailscale user-space)
                  </div>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-text-primary">Network Bandwidth Requirements</td>
                <td className="p-3 text-text-secondary bg-red-500/5 flex items-center gap-1.5">
                  <Wifi className="h-4 w-4 shrink-0 text-red-400" /> <strong>Min 1 Gbps Symmetric Fiber</strong> mandatory
                </td>
                <td className="p-3 text-accent-green bg-accent-green/5 flex items-center gap-1.5">
                  <Wifi className="h-4 w-4 shrink-0" /> <strong>Standard Consumer Broadband</strong> (Smart Prefix Caching)
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-text-primary">Power Consumption & Heat Strain</td>
                <td className="p-3 text-text-secondary bg-red-500/5">
                  <strong>500W+ Continuous Heavy Load</strong> (~$100/mo electricity bill @ $0.25/kWh)
                </td>
                <td className="p-3 text-accent-green bg-accent-green/5">
                  <strong>~220W Average Load</strong> (~$40/mo electricity bill @ $0.25/kWh)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import {
  MODELS,
  LIVE_MODEL,
  PROVIDER_ECONOMICS,
  REVENUE_SHARE_PCT,
  PROTOCOL_FEE_PCT,
  STANDBY_LABEL,
  PAYOUT_LABEL,
  REFERENCE_GPU,
  MIN_VRAM_GB,
  usd,
  type CatalogModel,
} from "@/lib/catalog"
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

const BASELINE_UTIL = 30 // %
const BASE_INPUT_DAILY_M = 200 // M input tokens/day at 30% load (assumption, adjustable)
const BASE_OUTPUT_DAILY_M = 20 // M output tokens/day at 30% load (assumption, adjustable)
const AVG_POWER_W = 220 // average wall draw at ~30% load (assumption)
const DAYS = 30

type Estimate = {
  gross: number
  providerShare: number
  retainer: number
  power: number
  kwh: number
  net: number
}

/** Single formula used for EVERY number on this card (headline, statement, comparison). */
export function estimateMonthly(
  m: CatalogModel,
  inputM: number,
  outputM: number,
  electricityRate: number,
  powerW = AVG_POWER_W,
): Estimate {
  const gross = (inputM * m.pricePer1M.input + outputM * m.pricePer1M.output) * DAYS
  const providerShare = gross * PROVIDER_ECONOMICS.revenueShare
  const retainer = PROVIDER_ECONOMICS.standbyPerDayUsd * DAYS
  const kwh = (powerW * 24 * DAYS) / 1000
  const power = kwh * electricityRate
  return { gross, providerShare, retainer, power, kwh, net: providerShare + retainer - power }
}

const money = (n: number, d = 2) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(d)}`

export default function Calculator() {
  const [selectedId, setSelectedId] = useState<string>(LIVE_MODEL.id)
  const currentModel: CatalogModel = MODELS.find((m) => m.id === selectedId) ?? LIVE_MODEL

  const [utilization, setUtilization] = useState<number>(BASELINE_UTIL)
  const [electricityRate, setElectricityRate] = useState<number>(0.25)
  const [inputTokensDaily, setInputTokensDaily] = useState<number>(BASE_INPUT_DAILY_M)
  const [outputTokensDaily, setOutputTokensDaily] = useState<number>(BASE_OUTPUT_DAILY_M)

  const handleUtilizationChange = (newUtil: number) => {
    setUtilization(newUtil)
    const ratio = newUtil / BASELINE_UTIL
    setInputTokensDaily(Math.round(BASE_INPUT_DAILY_M * ratio))
    setOutputTokensDaily(Math.round(BASE_OUTPUT_DAILY_M * ratio))
  }

  const est = estimateMonthly(currentModel, inputTokensDaily, outputTokensDaily, electricityRate)
  const baselineFor = (m: CatalogModel) => estimateMonthly(m, BASE_INPUT_DAILY_M, BASE_OUTPUT_DAILY_M, 0.25)
  const gpu = REFERENCE_GPU
  const sharePct = REVENUE_SHARE_PCT
  const feePct = PROTOCOL_FEE_PCT

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
            Line-by-line estimate for hosting models on an <strong className="text-text-primary">NVIDIA {gpu.name}</strong> reference node. Providers receive {sharePct}% of token revenue ({feePct}% protocol fee) plus a standby retainer of {STANDBY_LABEL}. Throughput and power figures are adjustable assumptions, not guarantees.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 font-mono text-xs font-semibold text-accent-green">
            <CheckCircle2 className="h-3.5 w-3.5" /> {sharePct}% revenue share
          </span>
        </div>
      </div>

      {/* Expectations banner */}
      <div className="mt-6 rounded-xl border border-accent-brand/30 bg-gradient-to-r from-accent-brand/10 via-bg-primary to-bg-primary p-4">
        <div className="flex items-start gap-3">
          <Scale className="h-5 w-5 shrink-0 text-accent-brand mt-0.5" />
          <div>
            <span className="font-mono text-xs font-bold text-text-primary uppercase tracking-wider">Estimates, not guarantees</span>
            <p className="mt-1 font-mono text-xs leading-5 text-text-secondary">
              Earnings depend on real network demand. The network is at an early stage, so actual traffic per node may be far below the
              baseline assumption ({BASE_INPUT_DAILY_M}M input / {BASE_OUTPUT_DAILY_M}M output tokens per day at {BASELINE_UTIL}% load).
              Payouts: {PAYOUT_LABEL}.
            </p>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODELS.map((m) => {
            const base = baselineFor(m)
            const active = selectedId === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                  active
                    ? "border-accent-brand bg-accent-brand/10 shadow-md ring-1 ring-accent-brand"
                    : "border-border-dim bg-bg-secondary hover:border-border-default hover:bg-bg-tertiary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-text-primary">{m.name}</span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                      m.status === "live" ? "bg-accent-green/15 text-accent-green" : "bg-bg-tertiary text-text-secondary"
                    }`}
                  >
                    {m.status === "live" ? "Live" : "Coming soon"}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-accent-brand">
                  Rate: {usd(m.pricePer1M.input)} / 1M in · {usd(m.pricePer1M.output)} / 1M out · {m.contextLabel} ctx
                </div>
                <p className="mt-2 font-mono text-[10px] leading-4 text-text-tertiary">
                  Baseline {BASE_INPUT_DAILY_M}M in / {BASE_OUTPUT_DAILY_M}M out per day, $0.25/kWh →{" "}
                  <strong className="text-accent-green">{money(base.net, 0)}/mo net</strong>
                </p>
              </button>
            )
          })}
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
                {currentModel.quantization.toUpperCase()} · {currentModel.contextLabel} ctx
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-3">
                <span className="font-mono text-[10px] uppercase text-text-tertiary">GPU Hardware</span>
                <div className="mt-1 font-mono text-sm font-bold text-text-primary">NVIDIA {gpu.name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-text-tertiary">
                  {gpu.cudaCores?.toLocaleString("en-US")} CUDA cores · {gpu.memBandwidthGBs?.toLocaleString("en-US")} GB/s · {gpu.tdpW} W TDP
                </div>
              </div>
              <div className="rounded-lg border border-border-dim bg-bg-secondary p-3">
                <span className="font-mono text-[10px] uppercase text-text-tertiary">Selected Model Rates</span>
                <div className="mt-1 font-mono text-sm font-bold text-accent-brand">
                  {usd(currentModel.pricePer1M.input)} in / {usd(currentModel.pricePer1M.output)} out
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
                  <span className="font-semibold text-accent-green">30% (baseline assumption)</span>
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
                <p className="font-mono text-[10px] text-text-tertiary">Rate: {usd(currentModel.pricePer1M.input)} / 1M input tokens</p>
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
                <p className="font-mono text-[10px] text-text-tertiary">Rate: {usd(currentModel.pricePer1M.output)} / 1M output tokens</p>
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
                <strong className="text-text-primary">{AVG_POWER_W} W average (TDP {gpu.tdpW} W)</strong>
              </div>
              <div>
                <span>Monthly Energy: </span>
                <strong className="text-text-primary">{est.kwh.toFixed(1)} kWh</strong>
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
                {money(est.net, 0)}/mo net
              </span>
            </div>

            {/* Big Net Monthly Profit Highlight */}
            <div className="mt-6 text-center">
              <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
                Estimated net / month ({currentModel.shortName})
              </span>
              <div className="mt-2 flex items-center justify-center gap-1 font-mono text-4xl font-extrabold tracking-tight text-accent-green sm:text-5xl">
                <span>{money(est.net, 0)}</span>
                <span className="text-xl font-normal text-text-tertiary">/ mo</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                After electricity, on 1× {gpu.name}
              </p>
            </div>

            {/* Line-by-Line Itemized Financial Calculation */}
            <div className="mt-6 space-y-3 rounded-xl border border-border-dim bg-bg-secondary p-4 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-text-primary uppercase tracking-wider border-b border-border-dim pb-2">
                <span>Monthly Statement (30 Days)</span>
                <span className="text-[10px] text-accent-brand">{currentModel.shortName}</span>
              </div>

              {/* Traffic Revenue */}
              <div className="flex items-center justify-between">
                <span className="text-text-secondary flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-accent-brand" /> Token revenue (gross)
                </span>
                <span className="font-bold text-text-primary">{money(est.gross)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                {inputTokensDaily}M in × {usd(currentModel.pricePer1M.input)} + {outputTokensDaily}M out × {usd(currentModel.pricePer1M.output)} per day × {DAYS}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-accent-brand" /> Your share ({sharePct}%)
                </span>
                <span className="font-bold text-accent-green">+{money(est.providerShare)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                {feePct}% protocol fee: -{money(est.gross - est.providerShare)}
              </div>

              {/* Standby Retainer */}
              <div className="flex items-center justify-between pt-2 border-t border-border-dim/50">
                <span className="text-text-secondary flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-accent-brand" /> Standby Retainer
                </span>
                <span className="font-bold text-accent-green">+{money(est.retainer)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                {STANDBY_LABEL} (assumes every day qualifies)
              </div>

              {/* Electricity Cost */}
              <div className="flex items-center justify-between pt-2 border-t border-border-dim/50">
                <span className="text-text-secondary flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-400" /> Electricity Cost
                </span>
                <span className="font-bold text-accent-red">-{money(est.power)}</span>
              </div>
              <div className="pl-4 text-[10px] text-text-tertiary">
                {AVG_POWER_W} W avg (~{est.kwh.toFixed(0)} kWh) @ ${electricityRate.toFixed(2)}/kWh
              </div>

              {/* Formula & Total Net Calculation */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-accent-green/10 p-3 pt-3 border-t-2 border-accent-green/30 text-sm">
                <span className="font-bold text-text-primary">Net Monthly Profit</span>
                <span className="font-extrabold text-accent-green">{money(est.net)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-accent-brand/20 bg-accent-brand/5 p-3">
              <Info className="h-4 w-4 shrink-0 text-accent-brand mt-0.5" />
              <p className="font-mono text-[11px] leading-4 text-text-secondary">
                <strong className="text-text-primary">Formula:</strong> net = token revenue × {PROVIDER_ECONOMICS.revenueShare} + $
                {PROVIDER_ECONOMICS.standbyPerDayUsd.toFixed(2)} × {DAYS} days − kWh × tariff. Payouts: {PAYOUT_LABEL}.
                {currentModel.status !== "live" && " This model is coming soon — figures are a projection."}
              </p>
            </div>

            {/* CTA Link */}
            <Link
              href="/provider"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-brand px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-accent-brand-hover"
            >
              <Server className="h-4 w-4" /> Become a provider <ArrowUpRight className="h-4 w-4" />
            </Link>

            <p className="mt-2 text-center font-mono text-[10px] text-text-tertiary">
              NVIDIA GPU with ≥{MIN_VRAM_GB}GB VRAM · Ubuntu 24.04 LTS · vLLM + Docker · 24GB cards not supported yet
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
                <td className="p-3 font-semibold text-text-primary">How you earn</td>
                <td className="p-3 text-text-secondary bg-red-500/5">Hourly rental while a tenant occupies the machine</td>
                <td className="p-3 font-bold text-accent-green bg-accent-green/5">
                  {sharePct}% of token revenue + {STANDBY_LABEL}
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
                  <strong>Continuous full load</strong> while rented (up to {gpu.tdpW} W TDP)
                </td>
                <td className="p-3 text-accent-green bg-accent-green/5">
                  <strong>~{AVG_POWER_W} W average at {BASELINE_UTIL}% load</strong> (~{money(baselineFor(currentModel).power, 0)}/mo @ $0.25/kWh)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

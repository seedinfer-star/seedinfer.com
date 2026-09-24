import Link from "next/link"
import { Cpu, Database, Layers, Zap } from "lucide-react"
import { LIVE_MODEL, MIN_VRAM_GB, REFERENCE_GPU, REVENUE_SHARE_PCT, CACHE_POLICY, usd } from "@/lib/catalog"

const IN = usd(LIVE_MODEL.pricePer1M.input)
const OUT = usd(LIVE_MODEL.pricePer1M.output)

export default function HeroMission() {
  return (
    <section className="bg-bg-primary">
      <div className="grid grid-cols-12 gap-6">
        {/* Left — main claim */}
        <div className="col-span-12 lg:col-span-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
            Private P2P inference · NVIDIA GPUs · {MIN_VRAM_GB}GB VRAM min
          </p>

          <h1 className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-tight text-text-primary sm:text-[32px] lg:text-[40px]">
            Inference at the cost of electricity.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-[15px]">
            We are driving decentralized AI inference toward the cost of electricity. Builders get an OpenAI-compatible API for{" "}
            {LIVE_MODEL.name} at {IN} / {OUT} per 1M tokens; GPU owners earn {REVENUE_SHARE_PCT}% of the token revenue their nodes serve.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/provider"
              className="inline-flex items-center justify-center rounded-xl bg-accent-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-brand/90"
            >
              Become a Provider →
            </Link>
            <Link
              href="#calculator"
              className="inline-flex items-center justify-center rounded-xl border border-border-dim bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              View calculator
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] text-text-tertiary">
            <span className="inline-flex items-center gap-1 rounded-full border border-border-dim bg-bg-secondary px-2.5 py-1">
              <Zap className="h-3 w-3 text-accent-green" /> {IN} in · {OUT} out / 1M
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border-dim bg-bg-secondary px-2.5 py-1">
              <Layers className="h-3 w-3" /> cached input free ({CACHE_POLICY.ttlSeconds}s TTL)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border-dim bg-bg-secondary px-2.5 py-1">
              <Cpu className="h-3 w-3" /> {LIVE_MODEL.contextLabel} context
            </span>
          </div>
        </div>

        {/* Right — spec card */}
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-6 rounded-xl border border-border-dim bg-bg-secondary p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">Live model</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-0.5 font-mono text-[10px] font-medium text-accent-green">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-green" /> NVFP4
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-lg bg-bg-primary px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-tertiary">
                  <Database className="h-3.5 w-3.5" /> Context
                </span>
                <span className="font-mono text-xs font-semibold text-text-primary">{LIVE_MODEL.contextLength.toLocaleString("en-US")} tokens</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-bg-primary px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-tertiary">
                  <Layers className="h-3.5 w-3.5" /> Quant
                </span>
                <span className="font-mono text-xs font-semibold text-text-primary">NVFP4 · FP8 KV</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-bg-primary px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-tertiary">
                  <Zap className="h-3.5 w-3.5" /> Pricing
                </span>
                <span className="font-mono text-xs font-semibold text-text-primary">{IN} / {OUT} · 1M</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-accent-brand/15 bg-accent-brand/5 px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-secondary">
                  <Cpu className="h-3.5 w-3.5 text-accent-brand" /> GPU min
                </span>
                <span className="font-mono text-xs font-semibold text-text-primary">{MIN_VRAM_GB}GB VRAM</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-3">
              <p className="font-mono text-[11px] leading-4 text-text-secondary">
                {LIVE_MODEL.name} · reference node {REFERENCE_GPU.name} · <strong className="font-semibold text-text-primary">{MIN_VRAM_GB}GB min</strong> VRAM · 24GB cards not supported yet
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 font-mono text-[10px] leading-3 text-text-tertiary">
              <span className="rounded bg-bg-tertiary px-2 py-1">CUDA 13.3+</span>
              <span className="rounded bg-bg-tertiary px-2 py-1">driver 580+</span>
              <span className="rounded bg-bg-tertiary px-2 py-1">Ubuntu 24.04</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

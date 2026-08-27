import Link from "next/link"
import { Cpu, Database, Layers, Zap } from "lucide-react"

export default function HeroMission() {
  return (
    <section className="bg-bg-primary">
      <div className="grid grid-cols-12 gap-6">
        {/* Left — main claim */}
        <div className="col-span-12 lg:col-span-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
            PRIVATE P2P INFERENCE · VERIFIED HARDWARE · 32GB VRAM MIN
          </p>

          <h1 className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-tight text-text-primary sm:text-[32px] lg:text-[40px]">
            Inference at the cost of electricity.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-[15px]">
            We optimize decentralized P2P AI inference down to the cost of electricity. Builders get private, ultra-fast LLMs at $0.02 / $0.05 per 1M tokens, while engineers and edge enthusiasts monetize idle GPUs with transparent revenue sharing.
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
              <Zap className="h-3 w-3 text-accent-green" /> $0.02 in · $0.05 out / 1M
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border-dim bg-bg-secondary px-2.5 py-1">
              <Layers className="h-3 w-3" /> prefix cache 60s free
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border-dim bg-bg-secondary px-2.5 py-1">
              <Cpu className="h-3 w-3" /> host 1:1 · marlin · flashinfer
            </span>
          </div>
        </div>

        {/* Right — spec card */}
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-6 rounded-xl border border-border-dim bg-bg-secondary p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">Phase 0 · Spec</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-0.5 font-mono text-[10px] font-medium text-accent-green">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-green" /> NVFP4
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-lg bg-bg-primary px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-tertiary">
                  <Database className="h-3.5 w-3.5" /> Context
                </span>
                <span className="font-mono text-xs font-semibold text-text-primary">1M ctx · 2M KV</span>
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
                <span className="font-mono text-xs font-semibold text-text-primary">$0.02 / $0.05 · 1M</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-accent-brand/15 bg-accent-brand/5 px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-secondary">
                  <Cpu className="h-3.5 w-3.5 text-accent-brand" /> GPU min
                </span>
                <span className="font-mono text-xs font-semibold text-text-primary">RTX 5090 32GB</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-3">
              <p className="font-mono text-[11px] leading-4 text-text-secondary">
                Blackwell GB202 · 1M ctx = 2M KV cache ~6GB KV + ~16–22GB model → ~28–30GB · <strong className="font-semibold text-text-primary">32GB min</strong> headroom @ 0.90 util
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

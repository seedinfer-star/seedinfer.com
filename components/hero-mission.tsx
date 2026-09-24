import Link from "next/link"
import { Cpu, Database, Layers, Zap } from "lucide-react"

export default function HeroMission() {
  return (
    <section className="bg-bg-primary">
      <div className="grid grid-cols-12 gap-6">
        {/* Main claim */}
        <div className="col-span-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
            P2P INFERENCE · VERIFIED HARDWARE · RTX 5090 32GB BASELINE
          </p>

          <h1 className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-tight text-text-primary sm:text-[32px] lg:text-[40px]">
            Inference at the cost of electricity.
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-[15px]">
            We optimize decentralized P2P AI inference down to the cost of electricity. Serving flagship <strong className="text-text-primary">Gemma 4 26B A4B NVFP4</strong> at <strong className="text-text-primary">$0.03 / $0.20 per 1M tokens</strong>, while engineers and edge enthusiasts monetize idle GPUs with transparent revenue sharing.
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
              <Zap className="h-3 w-3 text-accent-green" /> $0.03 in · $0.20 out / 1M
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border-dim bg-bg-secondary px-2.5 py-1">
              <Layers className="h-3 w-3" /> Gemma 4 26B A4B NVFP4
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border-dim bg-bg-secondary px-2.5 py-1">
              <Cpu className="h-3 w-3" /> RTX 5090 32GB min · CUDA 13.3+
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}


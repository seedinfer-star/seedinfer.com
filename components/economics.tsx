import { Cpu, Database, Zap } from "lucide-react"

export default function Economics() {
  return (
    <section className="rounded-xl border border-border-dim bg-bg-secondary p-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Left — text + mini cards */}
        <div className="col-span-12 lg:col-span-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">ECONOMICS · UNIT COST</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            Why 32GB VRAM is the threshold
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-text-secondary">
            Long-context inference is memory-bound. The economics are set by KV-cache size — not FLOPs. At 1M tokens, only 32GB+ cards
            sustain NVFP4 without offload.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card A — Memory */}
            <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                <Database className="h-3.5 w-3.5" /> Memory
              </div>
              <div className="mt-2 text-sm font-semibold leading-4 text-text-primary">1M ctx = 2M KV cache</div>
              <p className="mt-1.5 font-mono text-[11px] leading-4 text-text-secondary">
                NVFP4 W4A16 + FP8 KV · ~28–30GB with overhead · 1M KV alone ~6GB · <span className="font-semibold text-text-primary">32GB min</span> for headroom at 0.90 util.
              </p>
              <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px]">
                <span className="rounded bg-bg-secondary px-2 py-1 text-text-tertiary">NVFP4</span>
                <span className="rounded bg-bg-secondary px-2 py-1 text-text-tertiary">FP8 KV</span>
                <span className="rounded bg-accent-green/10 px-2 py-1 font-medium text-accent-green">32GB min</span>
              </div>
            </div>

            {/* Card B — Compute */}
            <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                <Cpu className="h-3.5 w-3.5" /> Compute
              </div>
              <div className="mt-2 text-sm font-semibold leading-4 text-text-primary">Marlin · FlashInfer · FP8</div>
              <p className="mt-1.5 font-mono text-[11px] leading-4 text-text-secondary">
                Blackwell-optimized kernels · chunked prefill · prefix caching · host 1:1 routing · no offload.
              </p>
              <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px] text-text-tertiary">
                <span className="rounded bg-bg-secondary px-2 py-1">marlin</span>
                <span className="rounded bg-bg-secondary px-2 py-1">flashinfer</span>
                <span className="rounded bg-bg-secondary px-2 py-1">fp8</span>
                <span className="rounded bg-bg-secondary px-2 py-1">host 1:1</span>
              </div>
            </div>

            {/* Card C — Power */}
            <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                <Zap className="h-3.5 w-3.5" /> Power
              </div>
              <div className="mt-2 text-sm font-semibold leading-4 text-text-primary">Electricity = dominant cost</div>
              <p className="mt-1.5 font-mono text-[11px] leading-4 text-text-secondary">
                At scale, power dominates unit cost. Builder price covers electricity + profit split.
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between font-mono text-[10px] text-text-tertiary">
                  <span>Builder</span>
                  <span>Provider</span>
                </div>
                {/* Placeholder where live cost split chart would be */}
                <div className="mt-1.5 flex h-10 items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-secondary px-3">
                  <span className="font-mono text-xs text-text-tertiary">Element requires refinement</span>
                </div>
                <p className="mt-1 font-mono text-[10px] leading-3 text-text-tertiary">Builder → Provider split · live metering pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — econ card */}
        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-xl border border-border-dim bg-bg-primary p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">Revenue split</p>
            <div className="mt-3 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between rounded-lg bg-bg-secondary px-3 py-2.5">
                <span className="text-text-tertiary">Builder pays</span>
                <span className="font-semibold text-text-primary">$0.02 in / $0.05 out · 1M</span>
              </div>
              <div className="flex items-center justify-center text-text-tertiary">↓</div>
              <div className="rounded-lg border border-accent-green/20 bg-accent-green/10 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Provider</span>
                  <span className="font-semibold text-accent-green">~60%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-secondary">
                  <div className="h-full w-[60%] rounded-full bg-accent-green" />
                </div>
                <p className="mt-1.5 text-[11px] leading-3 text-text-tertiary">share of gross · electricity-first margin</p>
              </div>
              <div className="flex items-center justify-center text-text-tertiary">↓</div>
              <div className="flex items-center justify-between rounded-lg bg-bg-secondary px-3 py-2.5">
                <span className="text-text-tertiary">Network</span>
                <span className="font-medium text-text-secondary">remainder · infra & fallback</span>
              </div>
            </div>

            {/* Placeholder for live revenue chart */}
            <div className="mt-4 flex h-[84px] items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-secondary">
              <span className="font-mono text-xs text-text-tertiary">Element requires refinement</span>
            </div>
            <p className="mt-2 text-center font-mono text-[10px] leading-3 text-text-tertiary">
              Live payout curve requires verified metering
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

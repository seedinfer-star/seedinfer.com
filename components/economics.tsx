import { Cpu, Database, Zap } from "lucide-react"
import { LIVE_MODEL, MIN_VRAM_GB, REVENUE_SHARE_PCT, PROTOCOL_FEE_PCT, STANDBY_LABEL, PAYOUT_LABEL, usd } from "@/lib/catalog"

export default function Economics() {
  return (
    <section className="rounded-xl border border-border-dim bg-bg-secondary p-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Left — text + mini cards */}
        <div className="col-span-12 lg:col-span-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">ECONOMICS · UNIT COST</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            Why {MIN_VRAM_GB}GB VRAM is the threshold
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-text-secondary">
            Long-context inference is memory-bound: the economics are set by weights + KV-cache size, not FLOPs. {LIVE_MODEL.name} with a{" "}
            {LIVE_MODEL.contextLabel} context needs a {MIN_VRAM_GB}GB+ card to run without offload. 24GB cards are not supported yet.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card A — Memory */}
            <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                <Database className="h-3.5 w-3.5" /> Memory
              </div>
              <div className="mt-2 text-sm font-semibold leading-4 text-text-primary">{LIVE_MODEL.contextLabel} context · NVFP4 weights</div>
              <p className="mt-1.5 font-mono text-[11px] leading-4 text-text-secondary">
                NVFP4 weights + FP8 KV cache + runtime overhead · <span className="font-semibold text-text-primary">{MIN_VRAM_GB}GB min</span> for headroom at 0.90 GPU memory utilization.
              </p>
              <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px]">
                <span className="rounded bg-bg-secondary px-2 py-1 text-text-tertiary">NVFP4</span>
                <span className="rounded bg-bg-secondary px-2 py-1 text-text-tertiary">FP8 KV</span>
                <span className="rounded bg-accent-green/10 px-2 py-1 font-medium text-accent-green">{MIN_VRAM_GB}GB min</span>
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
                <Zap className="h-3.5 w-3.5 text-accent-amber" /> Power &amp; retainer
              </div>
              <div className="mt-2 text-sm font-semibold leading-4 text-text-primary">Electricity = dominant cost</div>
              <p className="mt-1.5 font-mono text-[11px] leading-4 text-text-secondary">
                At scale, power dominates unit cost. Builder price covers electricity + profit split, and every node earns a standby retainer of{" "}
                {STANDBY_LABEL}.
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between font-mono text-[10px] text-text-tertiary">
                  <span>Provider {REVENUE_SHARE_PCT}%</span>
                  <span>Protocol {PROTOCOL_FEE_PCT}%</span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-bg-secondary">
                  <div className="h-full rounded-l-full bg-accent-green" style={{ width: `${REVENUE_SHARE_PCT}%` }} />
                  <div className="h-full flex-1 bg-accent-brand" />
                </div>
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
                <span className="font-semibold text-text-primary">
                  {usd(LIVE_MODEL.pricePer1M.input)} in / {usd(LIVE_MODEL.pricePer1M.output)} out · 1M
                </span>
              </div>
              <div className="flex items-center justify-center text-text-tertiary">↓</div>
              <div className="rounded-lg border border-accent-green/20 bg-accent-green/10 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Provider</span>
                  <span className="font-semibold text-accent-green">{REVENUE_SHARE_PCT}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-secondary">
                  <div className="h-full rounded-full bg-accent-green" style={{ width: `${REVENUE_SHARE_PCT}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-text-tertiary">of token revenue · plus standby retainer {STANDBY_LABEL}</p>
              </div>
              <div className="flex items-center justify-center text-text-tertiary">↓</div>
              <div className="flex items-center justify-between rounded-lg bg-bg-secondary px-3 py-2.5">
                <span className="text-text-tertiary">Protocol fee</span>
                <span className="font-medium text-text-secondary">{PROTOCOL_FEE_PCT}%</span>
              </div>
            </div>

            <p className="mt-4 rounded-lg border border-border-dim bg-bg-secondary p-3 font-mono text-[10px] leading-4 text-text-tertiary">
              Payouts: {PAYOUT_LABEL}. Fiat payouts are not available.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

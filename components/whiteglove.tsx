"use client"

import { CheckCircle2, Terminal } from "lucide-react"

const CHECKLIST = [
  "Remote Headscale join (tag:provider)",
  "Attestation & verification",
  "50GB HF sync & NVFP4 setup",
  "Bench marlin 0.93/128/4096",
  "Payouts EVM (6 chains) + Solana",
  "SLA & monitoring",
] as const

export default function WhiteGlove() {
  return (
    <section className="col-span-12 rounded-xl bg-accent-brand p-6 text-white lg:p-8">
      <div className="grid grid-cols-12 gap-8">
        {/* Left — copy */}
        <div className="col-span-12 lg:col-span-6">
          <p className="font-mono text-[10px] uppercase tracking-wide text-white/70">
            CONCIERGE · WHITE-GLOVE
          </p>
          <h2 className="mt-2 font-sans text-[22px] font-bold leading-tight lg:text-[28px]">
            VIP Managed Node — we configure it for you
          </h2>

          <ul className="mt-5 space-y-2.5">
            {CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 font-mono text-xs leading-4 text-white sm:text-sm"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <span className="inline-flex rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] leading-4 text-white">
              ≥32GB VRAM only
            </span>
          </div>
        </div>

        {/* Right — form card */}
        <div className="col-span-12 lg:col-span-6">
          <div className="rounded-xl border border-white/10 bg-bg-secondary p-5 text-text-primary">
            {/* Form UI only — no real submit logic */}
            <form onSubmit={(e) => e.preventDefault()} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* GPU model */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="wg-gpu"
                    className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary"
                  >
                    GPU model
                  </label>
                  <select
                    id="wg-gpu"
                    defaultValue=""
                    className="flex h-9 w-full rounded-lg border border-border-dim bg-bg-primary px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
                  >
                    <option value="" disabled>
                      Select GPU
                    </option>
                    <option value="rtx5090">RTX 5090 32GB</option>
                    <option value="rtx4090">RTX 4090 24GB</option>
                    <option value="h100">H100 80GB</option>
                    <option value="a100">A100 80GB</option>
                    <option value="blackwell-96">Blackwell 96GB HBM</option>
                    <option value="other">Other ≥32GB</option>
                  </select>
                </div>

                {/* VRAM */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="wg-vram"
                    className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary"
                  >
                    VRAM (GB)
                  </label>
                  <input
                    id="wg-vram"
                    type="number"
                    min={32}
                    placeholder="32"
                    className="flex h-9 w-full rounded-lg border border-border-dim bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label
                  htmlFor="wg-location"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary"
                >
                  Location
                </label>
                <input
                  id="wg-location"
                  type="text"
                  placeholder="City / Country or DC region"
                  className="flex h-9 w-full rounded-lg border border-border-dim bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
                />
              </div>

              {/* Email / Telegram */}
              <div className="space-y-1.5">
                <label
                  htmlFor="wg-contact"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary"
                >
                  Email / Telegram
                </label>
                <input
                  id="wg-contact"
                  type="text"
                  placeholder="you@example.com or @handle"
                  className="flex h-9 w-full rounded-lg border border-border-dim bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
                />
              </div>

              {/* CTA */}
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-xl bg-accent-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                // disabled state as placeholder — no real handling
              >
                Verify eligibility
              </button>
            </form>

            {/* NO MOCKS — placeholder for submit handling */}
            <div className="mt-3 flex h-[56px] items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-primary/60 px-3 text-center">
              <span className="font-mono text-xs text-text-tertiary">Element requires refinement</span>
            </div>
            <p className="mt-1.5 text-center font-mono text-[10px] leading-3 text-text-tertiary">
              Submit handling requires verification backend
            </p>

            {/* Curl snippet */}
            <div className="mt-4 rounded-lg border border-border-dim bg-bg-primary px-3 py-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                <Terminal className="h-3.5 w-3.5" />
                Quick install
              </div>
              <pre className="mt-2 overflow-x-auto rounded-md bg-bg-tertiary px-3 py-2.5 font-mono text-[11px] leading-4 text-text-secondary">
                <code>curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey hskey-xxx</code>
              </pre>
              <p className="mt-1.5 font-mono text-[10px] leading-3 text-text-tertiary">
                Headscale join after eligibility check · tag:provider
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

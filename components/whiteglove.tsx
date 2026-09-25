"use client"

import { CheckCircle2, Terminal } from "lucide-react"
import { LIVE_MODEL, MIN_VRAM_GB, PROVIDER_ECONOMICS, GITHUB_URL } from "@/lib/catalog"

const CHECKLIST = [
  "Remote Headscale join (tag:provider)",
  "Attestation & verification",
  `${LIVE_MODEL.name} download & setup`,
  "Throughput benchmark on your GPU",
  `Payouts in ${PROVIDER_ECONOMICS.payoutAsset} on ${PROVIDER_ECONOMICS.payoutChain} (${PROVIDER_ECONOMICS.payoutCadence})`,
  "SLA & monitoring",
] 

export default function WhiteGlove() {
  return (
    <section className="col-span-12 rounded-xl bg-accent-brand p-6 text-white lg:p-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Left — copy */}
        <div className="lg:col-span-6">
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
              ≥{MIN_VRAM_GB}GB VRAM only · 24GB cards not supported yet
            </span>
          </div>
        </div>

        {/* Right — form card */}
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-white/10 bg-bg-secondary p-5 text-text-primary">
            <div className="space-y-3">
              <p className="text-sm leading-5 text-text-secondary">
                Managed onboarding is handled by the SeedInfer team. Open an issue on GitHub with your GPU model, VRAM and region and we
                will get back to you.
              </p>
              <a
                href={`${GITHUB_URL}/issues/new?title=Managed%20node%20request`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-xl bg-accent-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-brand/90"
              >
                Request a managed node
              </a>
            </div>

            {/* Curl snippet */}
            <div className="mt-4 rounded-lg border border-border-dim bg-bg-primary px-3 py-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                <Terminal className="h-3.5 w-3.5" />
                Quick install
              </div>
              <pre className="mt-2 overflow-x-auto rounded-md bg-bg-tertiary px-3 py-2.5 font-mono text-[11px] leading-4 text-text-secondary">
                <code className="break-all">curl -fsSL https://seedinfer.com/install.sh | SEEDINFER_NODE_TOKEN=sipn_… bash</code>
              </pre>
              <p className="mt-1.5 font-mono text-[10px] leading-3 text-text-tertiary">
                Create a node token in the Provider portal (sign-in required)
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

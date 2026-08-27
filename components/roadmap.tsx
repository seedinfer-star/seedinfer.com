type Phase = {
  kicker: string
  title: string
  status: string
  desc: string
}

const PHASES: Phase[] = [
  {
    kicker: "FAZA 0 · NOW",
    title: "Nemotron Lightning 1M",
    status: "active",
    desc: "$0.02/$0.05 · 2M KV · Headscale RTX 5090 32GB · whitelist 20 × $0.40/day + $5 credits + 99% share",
  },
  {
    kicker: "FAZA 1 · Q4 2025",
    title: "Qwen 3.6 35B A3B + Gemma 4",
    status: "is coming",
    desc: "Vision + MoE · 100 nodes · 60% share stable",
  },
  {
    kicker: "FAZA 2 · Q1 2026",
    title: "1000+ nodes · Edge expansion",
    status: "planned",
    desc: "WhiteGlove scale · 96GB HBM · referral",
  },
  {
    kicker: "FAZA 3 · 2026",
    title: "Electricity-cost parity",
    status: "vision",
    desc: "Builder price = electricity + 10% → 0 margin",
  },
]

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-accent-green/15 text-accent-green border-accent-green/20"
  if (status === "is coming") return "bg-accent-amber/15 text-accent-amber border-accent-amber/20"
  return "bg-bg-tertiary text-text-tertiary border-border-dim"
}

export default function Roadmap() {
  return (
    <section className="col-span-12 py-8">
      {/* Header */}
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
        ROADMAP · 4 PHASES
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
        Roadmap · from electricity cost to parity
      </h2>

      {/* Timeline */}
      <div className="mt-8">
        {/* Grid — vertical border-l-2 on mobile, horizontal on desktop */}
        <div className="relative grid grid-cols-1 gap-6 border-l-2 border-border-dim pl-4 lg:grid-cols-4 lg:gap-6 lg:border-l-0 lg:pl-0">
          {/* Horizontal line — desktop */}
          <div className="absolute left-0 right-0 top-[18px] hidden h-px bg-border-dim lg:block" />
          {PHASES.map((phase) => {
            const isActive = phase.status === "active"
            return (
              <div
                key={phase.kicker}
                className={
                  isActive
                    ? "relative rounded-xl border border-accent-brand/20 bg-bg-secondary p-4"
                    : "relative rounded-xl border border-dashed border-border-dim bg-bg-secondary p-4 opacity-60"
                }
              >
                {/* Dot — desktop only */}
                <span
                  className={
                    isActive
                      ? "absolute -top-1.5 left-6 hidden h-3 w-3 rounded-full border-2 border-bg-primary bg-accent-brand lg:block"
                      : "absolute -top-1.5 left-6 hidden h-3 w-3 rounded-full border-2 border-bg-primary bg-border-dim lg:block"
                  }
                  aria-hidden="true"
                />

                {/* Kicker + status */}
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                    {phase.kicker}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${statusBadgeClass(phase.status)}`}
                  >
                    {phase.status}
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-semibold leading-5 text-text-primary">{phase.title}</h3>
                <p className="mt-1.5 font-mono text-[11px] leading-4 text-text-secondary">{phase.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Future metrics placeholder — NO MOCKS */}
      <div className="mt-6 flex items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-secondary p-3 text-center">
        <span className="font-mono text-[11px] leading-4 text-text-tertiary">Element requires refinement</span>
      </div>
      <p className="mt-1.5 text-center font-mono text-[10px] leading-3 text-text-tertiary">
        Live progress metrics pending — verified metering & timeline integration required
      </p>
    </section>
  )
}

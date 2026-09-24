import { LIVE_MODEL, MODELS, REVENUE_SHARE_PCT, STANDBY_LABEL, priceLabel } from "@/lib/catalog"

type Phase = {
  kicker: string
  title: string
  status: string
  desc: string
}

const nemotron = MODELS.find((m) => m.family === "Nemotron")!
const qwen = MODELS.find((m) => m.family === "Qwen")!

const PHASES: Phase[] = [
  {
    kicker: "Phase 0 · Now (Q3 2026)",
    title: `${LIVE_MODEL.name} live`,
    status: "active",
    desc: `${priceLabel(LIVE_MODEL)} per 1M · ${LIVE_MODEL.contextLabel} context · ${REVENUE_SHARE_PCT}% revenue share · standby ${STANDBY_LABEL}`,
  },
  {
    kicker: "Phase 1 · Q4 2026",
    title: `${nemotron.shortName} + ${qwen.shortName}`,
    status: "coming soon",
    desc: `${nemotron.contextLabel}-context Nemotron (${priceLabel(nemotron)}) and Qwen (${priceLabel(qwen)}) · target 100 nodes · ${REVENUE_SHARE_PCT}% share`,
  },
  {
    kicker: "Phase 2 · H1 2027",
    title: "Open provider marketplace",
    status: "planned",
    desc: `Target 300–1,000 nodes · more GPU classes · ${REVENUE_SHARE_PCT}% share`,
  },
  {
    kicker: "Phase 3 · 2027+",
    title: "Electricity-price parity",
    status: "vision",
    desc: `Target: token prices approaching the electricity cost of inference · ${REVENUE_SHARE_PCT}% share`,
  },
]

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-accent-green/15 text-accent-green border-accent-green/20"
  if (status === "coming soon") return "bg-accent-amber/15 text-accent-amber border-accent-amber/20"
  return "bg-bg-tertiary text-text-tertiary border-border-dim"
}

export default function Roadmap() {
  return (
    <section className="col-span-12 py-8">
      {/* Header */}
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
        Roadmap · 4 phases
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

    </section>
  )
}

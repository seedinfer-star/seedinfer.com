import Link from "next/link"
import type { Metadata } from "next"
import {
  ArrowRight,
  Activity,
  Cpu,
  KeyRound,
  Plug,
  Server,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react"
import AppShell, { PageContainer, SectionHeader } from "@/components/app-shell"
import { LiveKpiStrip } from "@/components/live-kpi-strip"
import { Card } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/copy-button"
import {
  API_BASE_URL,
  CACHE_POLICY,
  LIVE_MODEL,
  MIN_VRAM_GB,
  PAYOUT_LABEL,
  PROTOCOL_FEE_PCT,
  REVENUE_SHARE_PCT,
  usd,
} from "@/lib/catalog"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

const PY_SNIPPET = `from openai import OpenAI

client = OpenAI(
    base_url="${API_BASE_URL}",
    api_key="sk-seedinfer-...YOUR_KEY",
)

resp = client.chat.completions.create(
    model="${LIVE_MODEL.id}",
    messages=[{"role": "user", "content": "Hello from SeedInfer!"}],
)
print(resp.choices[0].message.content)`

const STEPS = [
  {
    icon: KeyRound,
    title: "Create an account",
    body: "Sign up and top up pay-as-you-go credit in USDC or ETH — no minimum commitment. API keys are in early access during the public beta.",
  },
  {
    icon: Plug,
    title: "Point your OpenAI client",
    body: `Swap the base URL for ${API_BASE_URL}. Existing SDKs, tools and agents work unchanged.`,
  },
  {
    icon: Cpu,
    title: "Verified GPUs serve it",
    body: "Requests are routed to attested NVIDIA GPUs run by independent providers, priced close to the electricity they burn.",
  },
]

export default function HomePage() {
  const m = LIVE_MODEL
  return (
    <AppShell>
      <PageContainer wide={false} className="space-y-14 md:space-y-20">
        {/* Hero */}
        <section className="relative overflow-x-clip pt-2 md:pt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-[380px] w-[900px] max-w-[140vw] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
            style={{
              background: "radial-gradient(closest-side, rgb(var(--accent-brand) / 0.22), transparent)",
            }}
          />
          <div className="relative grid items-start gap-10 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <Link
                href="/models"
                className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-secondary/80 px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-subtle hover:text-text-primary"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
                </span>
                Now serving {m.name}
                <ArrowRight className="h-3 w-3" />
              </Link>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
                AI inference at the price of{" "}
                <span className="bg-gradient-to-r from-accent-brand to-accent-brand-hover bg-clip-text text-transparent">
                  electricity
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-text-secondary sm:text-lg">
                SeedInfer is a decentralized, peer-to-peer inference network. Your requests run on verified NVIDIA GPUs
                owned by independent providers — through an OpenAI-compatible API, at near-electricity cost.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent-brand px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-brand-hover"
                >
                  <KeyRound className="h-4 w-4" /> Get started
                </Link>
                <Link
                  href="/provider"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
                >
                  <Server className="h-4 w-4" /> Become a provider
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-tertiary">
                <li className="inline-flex items-center gap-1.5">
                  <Plug className="h-3.5 w-3.5" /> OpenAI-compatible
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified NVIDIA GPUs
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> {REVENUE_SHARE_PCT}% to providers
                </li>
              </ul>
            </div>

            {/* Live model card */}
            <Card className="relative overflow-hidden p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">Live model</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-green/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase text-accent-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-green" /> Live
                </span>
              </div>
              <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-text-primary">{m.name}</h2>
              <p className="mt-1 break-all font-mono text-xs text-text-tertiary">{m.id}</p>
              <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border-dim bg-border-dim text-center">
                <div className="bg-bg-primary/60 px-2 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Context</dt>
                  <dd className="mt-1 text-lg font-semibold text-text-primary">{m.contextLabel}</dd>
                </div>
                <div className="bg-bg-primary/60 px-2 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Input</dt>
                  <dd className="mt-1 text-lg font-semibold text-text-primary">{usd(m.pricePer1M.input)}</dd>
                </div>
                <div className="bg-bg-primary/60 px-2 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Output</dt>
                  <dd className="mt-1 text-lg font-semibold text-text-primary">{usd(m.pricePer1M.output)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-center font-mono text-[10px] text-text-tertiary">USD per 1M tokens</p>
              <ul className="mt-4 space-y-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2">
                  <Zap className="h-4 w-4 shrink-0 text-accent-brand" /> {CACHE_POLICY.label}
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-accent-brand" /> {m.quantization.toUpperCase()} weights on
                  NVIDIA Blackwell
                </li>
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link
                  href="/chat"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border-default bg-bg-secondary text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
                >
                  Try in chat
                </Link>
                <Link
                  href="/models"
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg text-sm font-medium text-accent-brand transition-colors hover:bg-accent-brand/10"
                >
                  All models <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          </div>
        </section>

        {/* KPIs */}
        <section className="space-y-4" aria-labelledby="live-network">
          <SectionHeader
            id="live-network"
            eyebrow="Live network"
            title="Network status, refreshed every 15 seconds"
            actions={
              <Link href="/stats" className="inline-flex items-center gap-1 text-sm font-medium text-accent-brand hover:underline">
                Full network stats <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <LiveKpiStrip />
        </section>

        {/* Code */}
        <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.3fr]" aria-labelledby="drop-in">
          <div>
            <p className="section-eyebrow">Developers</p>
            <h2 id="drop-in" className="mt-2 font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              A drop-in OpenAI replacement
            </h2>
            <p className="mt-3 text-text-secondary">
              Change two lines — the base URL and the key. Chat Completions, including streaming, work with the SDKs
              you already use.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-default bg-bg-secondary px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Read the docs
              </Link>
              <Link
                href="/api-console"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-accent-brand transition-colors hover:bg-accent-brand/10"
              >
                Open API console <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <Card className="min-w-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-dim px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-border-subtle" />
                <span className="h-2.5 w-2.5 rounded-full bg-border-subtle" />
                <span className="h-2.5 w-2.5 rounded-full bg-border-subtle" />
                <span className="ml-2 font-mono text-xs text-text-tertiary">main.py</span>
              </div>
              <CopyButton text={PY_SNIPPET} label="Copy Python example" />
            </div>
            <pre className="overflow-x-auto bg-bg-primary/50 p-4 font-mono text-[12.5px] leading-6 text-text-primary">
              <code>{PY_SNIPPET}</code>
            </pre>
          </Card>
        </section>

        {/* How it works */}
        <section className="space-y-6" aria-labelledby="how">
          <SectionHeader id="how" eyebrow="How it works" title="From request to verified GPU in three steps" />
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <li key={s.title}>
                  <Card className="h-full p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-xs text-text-tertiary">0{i + 1}</span>
                    </div>
                    <h3 className="mt-4 font-semibold text-text-primary">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-text-secondary">{s.body}</p>
                  </Card>
                </li>
              )
            })}
          </ol>
        </section>

        {/* Provider CTA */}
        <section aria-labelledby="providers-cta">
          <Card className="relative overflow-hidden border-accent-brand/25 p-6 md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(600px circle at 100% 0%, rgb(var(--accent-brand) / 0.16), transparent 60%)",
              }}
            />
            <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="section-eyebrow">For GPU owners</p>
                <h2 id="providers-cta" className="mt-2 font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                  Keep {REVENUE_SHARE_PCT}% of what your GPU earns
                </h2>
                <p className="mt-3 max-w-xl text-text-secondary">
                  Got an NVIDIA card with {MIN_VRAM_GB} GB+ of VRAM? Install the agent with one command and start serving
                  inference. The network takes a {PROTOCOL_FEE_PCT}% fee — the rest is yours. Payouts: {PAYOUT_LABEL}.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/provider"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-brand-hover"
                  >
                    <Server className="h-4 w-4" /> Become a provider
                  </Link>
                  <Link
                    href="/earn"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
                  >
                    Estimate earnings
                  </Link>
                </div>
              </div>
              <div className="rounded-xl border border-border-dim bg-bg-primary/70 p-5 text-center">
                <div className="font-display text-6xl font-bold tracking-tight text-text-primary">
                  {REVENUE_SHARE_PCT}
                  <span className="text-accent-brand">%</span>
                </div>
                <p className="mt-2 text-sm text-text-secondary">of inference revenue goes to the provider</p>
                <Link
                  href="/providers"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-brand hover:underline"
                >
                  <Activity className="h-3.5 w-3.5" /> See the provider fleet
                </Link>
              </div>
            </div>
          </Card>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border-dim pt-6 text-xs text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SeedInfer · Public beta</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/docs" className="hover:text-text-primary">Docs</Link>
            <Link href="/models" className="hover:text-text-primary">Models</Link>
            <Link href="/stats" className="hover:text-text-primary">Network stats</Link>
            <Link href="/provider" className="hover:text-text-primary">Providers</Link>
            <a href="https://github.com/seedinfer-star/seedinfer.com" className="hover:text-text-primary" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </footer>
      </PageContainer>
    </AppShell>
  )
}

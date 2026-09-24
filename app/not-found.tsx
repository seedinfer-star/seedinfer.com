import Link from "next/link"
import type { Metadata } from "next"
import { ArrowLeft, Compass } from "lucide-react"
import { LogoMark } from "@/components/ui/logo"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
}

const SUGGESTIONS = [
  { href: "/", label: "Overview" },
  { href: "/models", label: "Models" },
  { href: "/docs", label: "Docs" },
  { href: "/stats", label: "Network stats" },
  { href: "/provider", label: "Become a provider" },
]

export default function NotFound() {
  return (
    <main
      id="main"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg-primary px-6 py-16 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] max-w-[160vw] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgb(var(--accent-brand) / 0.18), transparent)" }}
      />
      <div className="relative flex flex-col items-center">
        <Link href="/" aria-label="SeedInfer home" className="rounded-lg">
          <LogoMark className="h-10 w-10" />
        </Link>
        <p className="mt-8 font-mono text-sm text-accent-brand">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          This page wandered off the network
        </h1>
        <p className="mt-3 max-w-md text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Try one of these instead:
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex h-8 items-center rounded-full border border-border-default bg-bg-secondary px-3 text-sm text-text-secondary transition-colors hover:border-border-subtle hover:text-text-primary"
            >
              {s.label}
            </Link>
          ))}
        </div>
        <Link
          href="/"
          className="mt-8 inline-flex h-10 items-center gap-2 rounded-lg bg-accent-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-brand-hover"
        >
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
        <p className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] text-text-tertiary">
          <Compass className="h-3 w-3" /> seedinfer.com
        </p>
      </div>
    </main>
  )
}

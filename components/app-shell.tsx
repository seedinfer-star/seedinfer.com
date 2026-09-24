import * as React from "react"
import Sidebar from "@/components/sidebar"
import { cn } from "@/lib/utils"

/**
 * Responsive application shell: sidebar (≥ md) / top bar + drawer (< md)
 * and a single scrollable content column.
 *
 *   <AppShell>
 *     <PageHeader title="…" />
 *     <PageContainer>…</PageContainer>
 *   </AppShell>
 */
export default function AppShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg-primary md:flex-row">
      <Sidebar />
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>{children}</div>
    </div>
  )
}

/** Page header bar shown above the scroll area. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-border-dim bg-bg-secondary/60 px-4 py-2 md:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight text-text-primary">{title}</h1>
        {description && <p className="truncate font-mono text-[11px] text-text-tertiary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Scrollable main area with the standard container width & padding. */
export function PageContainer({
  children,
  className,
  wide = true,
}: {
  children: React.ReactNode
  className?: string
  /** true → max-w-[1600px] dashboard width; false → max-w-7xl */
  wide?: boolean
}) {
  return (
    <main id="main" className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
      <div
        className={cn(
          "mx-auto w-full space-y-6 px-4 py-6 md:px-6 md:py-8",
          wide ? "max-w-shell" : "max-w-7xl",
          className
        )}
      >
        {children}
      </div>
    </main>
  )
}

/** Consistent section heading. */
export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  id,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  id?: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="section-eyebrow mb-1">{eyebrow}</p>}
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-text-tertiary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

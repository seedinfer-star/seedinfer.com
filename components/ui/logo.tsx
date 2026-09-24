import * as React from "react"
import { cn } from "@/lib/utils"

/** SeedInfer mark — indigo rounded tile with a seed. Mirrors app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-7 w-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <path d="M16 6.5c-5.2 3.1-8.2 7.4-8.2 12a8.2 8.2 0 0 0 16.4 0c0-4.6-3-8.9-8.2-12z" fill="#fff" />
      <path d="M16 13.5v11.2M16 19.2l3.2-2.6" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark />
      <span className="min-w-0">
        <span className="block truncate font-display text-[15px] font-bold leading-none tracking-tight text-text-primary">
          SeedInfer
        </span>
        {subtitle && (
          <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-text-tertiary">
            P2P GPU inference
          </span>
        )}
      </span>
    </span>
  )
}

export default Logo

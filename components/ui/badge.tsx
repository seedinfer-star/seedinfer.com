"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "outline" }) {
  const v: Record<string,string> = {
    default: "bg-accent-brand/10 text-accent-brand border-accent-brand/20",
    success: "bg-accent-green/10 text-accent-green border-accent-green/20",
    warning: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
    outline: "bg-transparent text-text-secondary border-border-default",
  }
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide", v[variant], className)} {...props} />
}

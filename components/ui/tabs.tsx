"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

type TabsCtx = { value: string; setValue: (v: string) => void }
const Ctx = React.createContext<TabsCtx | null>(null)

export function Tabs({ defaultValue, value, onValueChange, children, className }: { defaultValue?: string; value?: string; onValueChange?: (v:string)=>void; children: React.ReactNode; className?: string }) {
  const [internal, setInternal] = React.useState(defaultValue ?? "")
  const v = value ?? internal
  const setValue = (nv: string) => {
    if (value === undefined) setInternal(nv)
    onValueChange?.(nv)
  }
  return <Ctx.Provider value={{ value: v, setValue }}><div className={cn(className)}>{children}</div></Ctx.Provider>
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex items-center rounded-lg border border-border-dim bg-bg-tertiary p-1", className)} {...props} />
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(Ctx)!
  const active = ctx.value === value
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-bg-secondary text-text-primary shadow-sm border border-border-dim" : "text-text-tertiary hover:text-text-secondary",
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(Ctx)!
  if (ctx.value !== value) return null
  return <div className={cn(className)}>{children}</div>
}

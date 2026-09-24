"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export function Select({ value, onValueChange, children }: { value: string; onValueChange: (v:string)=>void; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return <div className="relative">{React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as any, { value, onValueChange, open, setOpen })
    }
    return child
  })}</div>
}

export function SelectTrigger({ value, open, setOpen, children, className }: any) {
  return (
    <button onClick={() => setOpen(!open)} className={cn("inline-flex h-8 items-center justify-between rounded-lg border border-border-default bg-bg-secondary px-3 text-xs text-text-primary hover:bg-bg-hover", className)}>
      <span className="truncate">{children || value}</span>
      <ChevronDown className="ml-2 h-3 w-3 opacity-60" />
    </button>
  )
}

export function SelectContent({ open, value, onValueChange, children }: any) {
  if (!open) return null
  return (
    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border-default bg-bg-secondary shadow-lg">
      {React.Children.map(children, (c: any) => React.isValidElement(c) ? React.cloneElement(c as React.ReactElement<any>, { onValueChange, setOpen: (c.props as any).setOpen, _selected: (c.props as any).value === value } as any) : c)}
    </div>
  )
}

export function SelectItem({ value, children, onValueChange, setOpen }: any) {
  return (
    <button onClick={() => { onValueChange?.(value); setOpen?.(false) }} className="flex w-full items-center px-3 py-2 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary text-left">
      {children}
    </button>
  )
}

export function SelectValue({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

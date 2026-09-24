"use client"

import { useTheme } from "./theme-provider"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  variant?: "icon" | "segmented" | "menu"
  className?: string
}

export default function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme, mounted } = useTheme()

  if (!mounted) {
    if (variant === "menu") return <div className={cn("h-8 w-full rounded-lg skeleton", className)} />
    if (variant === "segmented") return <div className={cn("h-9 w-56 rounded-xl skeleton", className)} />
    return <div className={cn("h-8 w-8 rounded-lg skeleton", className)} />
  }

  const isDark = theme === "dark"
  const nextLabel = isDark ? "Switch to light theme" : "Switch to dark theme"

  if (variant === "segmented") {
    const opt = (value: "light" | "dark", label: string, Icon: typeof Sun) => (
      <button
        type="button"
        onClick={() => setTheme(value)}
        aria-pressed={theme === value}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
          theme === value
            ? "border border-border-subtle bg-bg-secondary text-text-primary shadow-sm"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>
    )
    return (
      <div
        role="group"
        aria-label="Theme"
        className={cn("inline-flex items-center gap-1 rounded-xl border border-border-dim bg-bg-tertiary p-1", className)}
      >
        {opt("light", "Light", Sun)}
        {opt("dark", "Dark", Moon)}
      </div>
    )
  }

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={nextLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary",
          className
        )}
      >
        <span className="flex items-center gap-2">
          {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          <span>Theme</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">{isDark ? "Dark" : "Light"}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={nextLabel}
      aria-label={nextLabel}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-bg-secondary text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary",
        className
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

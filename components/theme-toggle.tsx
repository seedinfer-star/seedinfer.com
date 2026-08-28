"use client"

import { useTheme } from "./theme-provider"
import { Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  variant?: "icon" | "segmented" | "menu"
  className?: string
}

export default function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn("h-8 w-8 rounded-lg bg-bg-tertiary border border-border-dim animate-pulse", className)} />
    )
  }

  if (variant === "segmented") {
    return (
      <div className={cn("inline-flex items-center gap-1 rounded-xl border border-border-dim bg-bg-tertiary p-1", className)}>
        <button
          onClick={() => setTheme("light")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            theme === "light"
              ? "bg-bg-secondary text-text-primary shadow-sm border border-border-subtle"
              : "text-text-tertiary hover:text-text-secondary"
          )}
          title="Switch to White (Light) mode"
        >
          <Sun className="h-3.5 w-3.5 text-amber-500" />
          <span>White mode</span>
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            theme === "dark"
              ? "bg-bg-secondary text-text-primary shadow-sm border border-border-subtle"
              : "text-text-tertiary hover:text-text-secondary"
          )}
          title="Switch to Dark mode"
        >
          <Moon className="h-3.5 w-3.5 text-indigo-400" />
          <span>Dark mode</span>
        </button>
      </div>
    )
  }

  if (variant === "menu") {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors",
          className
        )}
        title={theme === "dark" ? "Switch to White (Light) mode" : "Switch to Dark mode"}
      >
        <div className="flex items-center gap-2">
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-indigo-500" />
          )}
          <span>Appearance</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
          {theme === "dark" ? "Dark" : "White"}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-border-default bg-bg-tertiary px-2.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary active:scale-95 shadow-sm",
        className
      )}
      title={theme === "dark" ? "Switch to White (Light) mode" : "Switch to Dark mode"}
      aria-label="Toggle theme mode"
    >
      {theme === "dark" ? (
        <>
          <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
          <span className="hidden sm:inline text-[11px] font-medium">White mode</span>
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5 text-indigo-600 transition-transform duration-300" />
          <span className="hidden sm:inline text-[11px] font-medium">Dark mode</span>
        </>
      )}
    </button>
  )
}

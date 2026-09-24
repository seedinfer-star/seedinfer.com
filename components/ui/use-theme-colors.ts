"use client"
import { useEffect, useState } from "react"
import { useTheme } from "@/components/theme-provider"

/**
 * Resolves theme tokens (CSS vars holding "R G B" channels, see globals.css)
 * into concrete colour strings — for canvas / SVG libraries (recharts,
 * maplibre) that can't use CSS variables in attributes.
 */
const TOKENS = {
  brand: "--accent-brand",
  brandHover: "--accent-brand-hover",
  green: "--accent-green",
  amber: "--accent-amber",
  red: "--accent-red",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textTertiary: "--text-tertiary",
  borderDim: "--border-dim",
  borderDefault: "--border-default",
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgTertiary: "--bg-tertiary",
} as const

export type ThemeColors = Record<keyof typeof TOKENS, string>

const DARK_FALLBACK: ThemeColors = {
  brand: "rgb(99, 102, 241)",
  brandHover: "rgb(129, 140, 248)",
  green: "rgb(16, 185, 129)",
  amber: "rgb(245, 158, 11)",
  red: "rgb(248, 113, 113)",
  textPrimary: "rgb(250, 250, 250)",
  textSecondary: "rgb(161, 161, 170)",
  textTertiary: "rgb(113, 113, 122)",
  borderDim: "rgb(30, 30, 34)",
  borderDefault: "rgb(39, 39, 42)",
  bgPrimary: "rgb(9, 9, 11)",
  bgSecondary: "rgb(17, 17, 19)",
  bgTertiary: "rgb(24, 24, 27)",
}

function read(): ThemeColors {
  const cs = getComputedStyle(document.documentElement)
  const out = { ...DARK_FALLBACK }
  for (const [k, v] of Object.entries(TOKENS) as [keyof typeof TOKENS, string][]) {
    const parts = cs.getPropertyValue(v).trim().split(/[\s,]+/).filter(Boolean)
    if (parts.length >= 3) out[k] = `rgb(${parts.slice(0, 3).join(", ")})`
  }
  return out
}

export function useThemeColors(): ThemeColors {
  const { theme } = useTheme()
  const [colors, setColors] = useState<ThemeColors>(DARK_FALLBACK)
  useEffect(() => {
    setColors(read())
  }, [theme])
  return colors
}

/** Add alpha to an "rgb(r, g, b)" string. */
export function withAlpha(rgb: string, alpha: number) {
  return rgb.replace(/^rgb\(([^)]+)\)$/, `rgba($1, ${alpha})`)
}

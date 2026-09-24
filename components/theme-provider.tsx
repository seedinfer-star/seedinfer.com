"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  mounted: boolean
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "seedinfer_theme"

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  mounted: false,
  toggleTheme: () => {},
  setTheme: () => {},
})

function applyTheme(t: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", t === "dark")
  root.classList.toggle("light", t === "light")
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Dark-first. The inline script in app/layout.tsx has already applied the
  // stored preference before hydration; we just sync React state with it.
  const [theme, setThemeState] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let initial: Theme = "dark"
    try {
      if (localStorage.getItem(STORAGE_KEY) === "light") initial = "light"
    } catch {}
    setThemeState(initial)
    applyTheme(initial)
    setMounted(true)

    // keep multiple tabs in sync
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const next: Theme = e.newValue === "light" ? "light" : "dark"
      setThemeState(next)
      applyTheme(next)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {}
    applyTheme(t)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {}
      applyTheme(next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

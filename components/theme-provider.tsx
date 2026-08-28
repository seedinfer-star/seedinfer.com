"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("seedinfer_theme") as Theme | null
    if (stored === "light" || stored === "dark") {
      setThemeState(stored)
      applyTheme(stored)
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const initial: Theme = prefersDark ? "dark" : "dark" // default to dark
      setThemeState(initial)
      applyTheme(initial)
    }
  }, [])

  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    if (t === "light") {
      root.classList.remove("dark")
      root.classList.add("light")
    } else {
      root.classList.add("dark")
      root.classList.remove("light")
    }
  }

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem("seedinfer_theme", t)
    } catch {}
    applyTheme(t)
  }

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

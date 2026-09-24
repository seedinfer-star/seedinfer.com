import type { Config } from "tailwindcss"

/**
 * All theme colours are CSS variables holding space-separated RGB channels
 * (e.g. `--accent-brand: 79 70 229;`, see app/globals.css) so Tailwind opacity
 * modifiers work: `bg-accent-green/15`, `border-accent-brand/20`, …
 * In raw CSS / inline styles use `rgb(var(--token))` or `rgb(var(--token) / 0.5)`.
 */
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // borders
        border: c("border-default"),
        "border-default": c("border-default"),
        "border-dim": c("border-dim"),
        "border-subtle": c("border-subtle"),
        input: c("border-default"),
        ring: c("accent-brand"),
        // surfaces
        background: c("bg-primary"),
        foreground: c("text-primary"),
        "bg-primary": c("bg-primary"),
        "bg-secondary": c("bg-secondary"),
        "bg-tertiary": c("bg-tertiary"),
        "bg-elevated": c("bg-elevated"),
        "bg-hover": c("bg-hover"),
        "bg-white": c("bg-white"),
        // text
        "text-primary": c("text-primary"),
        "text-secondary": c("text-secondary"),
        "text-tertiary": c("text-tertiary"),
        ink: c("ink"),
        "ink-light": c("ink-light"),
        "ink-faint": c("ink-faint"),
        // accents
        "accent-brand": c("accent-brand"),
        "accent-brand-dim": c("accent-brand-dim"),
        "accent-brand-hover": c("accent-brand-hover"),
        "accent-green": c("accent-green"),
        "accent-green-dim": c("accent-green-dim"),
        "accent-amber": c("accent-amber"),
        "accent-amber-dim": c("accent-amber-dim"),
        "accent-red": c("accent-red"),
        "accent-red-dim": c("accent-red-dim"),
        "accent-blue": c("blue"),
        "accent-purple": c("purple"),
        // legacy aliases
        coral: c("coral"),
        "coral-light": c("coral-light"),
        teal: c("teal"),
        "teal-light": c("teal-light"),
        "blue-light": c("blue-light"),
        danger: c("danger"),
        // shadcn-style aliases
        card: c("bg-secondary"),
        "card-foreground": c("text-primary"),
        muted: c("bg-tertiary"),
        "muted-foreground": c("text-tertiary"),
      },
      borderRadius: {
        xl: "0.75rem",
        lg: "0.625rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "system-ui", "sans-serif"],
        logo: ["var(--font-jakarta)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: {
        shell: "1600px",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-in-left": "slide-in-left 200ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
}
export default config

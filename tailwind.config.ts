import type { Config } from "tailwindcss"

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
        border: "var(--border-default)",
        "border-dim": "var(--border-dim)",
        "border-subtle": "var(--border-subtle)",
        input: "var(--border-default)",
        ring: "var(--accent-brand)",
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-tertiary": "var(--bg-tertiary)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-hover": "var(--bg-hover)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "accent-brand": "var(--accent-brand)",
        "accent-brand-dim": "var(--accent-brand-dim)",
        "accent-green": "var(--accent-green)",
        "accent-green-dim": "var(--accent-green-dim)",
        "accent-amber": "var(--accent-amber)",
        "accent-red": "var(--accent-red)",
        card: "var(--bg-secondary)",
        "card-foreground": "var(--text-primary)",
        muted: "var(--bg-tertiary)",
        "muted-foreground": "var(--text-tertiary)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ABC Repro", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ABC Repro Mono", "IBM Plex Mono", "monospace"],
        display: ["Louize", "Georgia", "serif"],
        logo: ["Louize", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
}
export default config

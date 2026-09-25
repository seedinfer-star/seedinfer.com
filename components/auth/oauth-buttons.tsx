"use client"

import { useEffect, useState } from "react"
import { Chrome, Github } from "lucide-react"
import { cn } from "@/lib/utils"

type ProviderId = "google" | "github"

const ITEMS: Array<{ id: ProviderId; label: string; Icon: typeof Github }> = [
  { id: "google", label: "Google", Icon: Chrome },
  { id: "github", label: "GitHub", Icon: Github },
]

const BTN =
  "inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-tertiary px-4 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated"

/**
 * Google / GitHub sign-in buttons. Availability comes from /api/auth/providers (no secrets);
 * until it loads the buttons are plain links, so SSR and the first client render match.
 */
export default function OAuthButtons({ next = "/billing", intent = "signin" }: { next?: string; intent?: "signin" | "signup" }) {
  const [enabled, setEnabled] = useState<Partial<Record<ProviderId, boolean>> | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/auth/providers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !Array.isArray(d?.providers)) return
        setEnabled(Object.fromEntries(d.providers.map((p: { id: ProviderId; enabled: boolean }) => [p.id, !!p.enabled])))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/billing"
  const verb = intent === "signup" ? "Sign up with" : "Continue with"

  return (
    <div className="grid gap-2">
      {ITEMS.map(({ id, label, Icon }) =>
        enabled !== null && !enabled[id] ? (
          <span
            key={id}
            aria-disabled="true"
            title={`${label} sign-in is not available right now`}
            className={cn(BTN, "cursor-not-allowed opacity-50 hover:bg-bg-tertiary")}
          >
            <Icon className="h-4 w-4" />
            {verb} {label}
            <span className="font-mono text-[10px] text-text-tertiary">· unavailable</span>
          </span>
        ) : (
          <a key={id} href={`/api/auth/login/${id}?next=${encodeURIComponent(safeNext)}`} className={BTN}>
            <Icon className="h-4 w-4" />
            {verb} {label}
          </a>
        )
      )}
    </div>
  )
}

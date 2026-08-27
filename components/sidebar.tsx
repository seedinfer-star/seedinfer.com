"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  MessageSquare,
  Activity,
  Trophy,
  Server,
  Coins,
  Code2,
  Cpu,
  CreditCard,
  Settings,
  PanelLeftClose,
  FileText,
  LogIn,
  UserPlus,
  LogOut,
  BadgeCheck,
} from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: React.ElementType; active?: boolean; external?: boolean }

const useNetwork: NavItem[] = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/stats", label: "Network stats", icon: Activity },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
]
const provide: NavItem[] = [
  { href: "/provider", label: "Become a Provider", icon: Server },
  { href: "/providers", label: "Provider fleet", icon: Server },
  { href: "/earn", label: "Earnings", icon: Coins },
]
const build: NavItem[] = [
  { href: "/api-console", label: "API console", icon: Code2 },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/docs", label: "Docs", icon: FileText },
]

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label={title} className="mt-3 first:mt-1">
      <p className="mb-1 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-text-tertiary">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((it) => {
          const isActive = it.active ? pathname === it.href || pathname.startsWith(it.href + "/") : pathname === it.href
          // special: "/" should only be active on exact "/"
          const computedActive = it.href === "/" ? pathname === "/" : isActive
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "group relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-2",
                computedActive
                  ? "bg-accent-brand/10 font-semibold text-accent-brand"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              )}
            >
              {computedActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-accent-brand" />}
              <Icon
                className={cn(
                  "h-[15px] w-[15px]",
                  computedActive ? "text-accent-brand" : "text-text-tertiary group-hover:text-text-secondary"
                )}
              />
              <span>{it.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function BottomNav() {
  const pathname = usePathname()
  const items: NavItem[] = [
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/settings", label: "Settings", icon: Settings },
  ]
  return (
    <nav aria-label="Account" className="space-y-0.5">
      {items.map((it) => {
        const isActive = pathname === it.href
        const Icon = it.icon
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "group relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-2",
              isActive
                ? "bg-accent-brand/10 font-semibold text-accent-brand"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
          >
            {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-accent-brand" />}
            <Icon
              className={cn("h-[15px] w-[15px]", isActive ? "text-accent-brand" : "text-text-tertiary group-hover:text-text-secondary")}
            />
            <span>{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function AuthNav() {
  const pathname = usePathname()
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<{ email: string; avatar_url: string | null; balance: number; email_verified: any } | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then(async (r) => {
        if (cancelled) return
        if (r.ok) {
          try {
            const data = await r.json()
            if (data?.user) {
              setIsAuthed(true)
              setProfile({
                email: data.user.email,
                avatar_url: data.user.avatar_url ?? null,
                balance: data.credits?.balance_usd ?? 0,
                email_verified: data.user.email_verified,
              })
            } else {
              setIsAuthed(true)
              setProfile(null)
            }
          } catch {
            setIsAuthed(true)
            setProfile(null)
          }
        } else if (r.status === 401) {
          setIsAuthed(false)
          setProfile(null)
        } else {
          setIsAuthed(false)
          setProfile(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAuthed(false)
          setProfile(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [pathname])
  if (isAuthed === true && profile) {
    const initial = profile.email ? profile.email[0].toUpperCase() : "?"
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg-primary px-2.5 py-2 border border-border-dim">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.email} className="h-7 w-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-brand/15 text-[11px] font-semibold text-accent-brand">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium truncate leading-tight">{profile.email}</div>
          <div className="font-mono text-[10px] text-text-tertiary">${Number(profile.balance).toFixed(2)}</div>
        </div>
        {profile.email_verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent-green" /> : null}
      </div>
    )
  }
  if (isAuthed === true && !profile) {
    // authed but still loading profile - show skeleton to avoid layout shift
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg-primary px-2.5 py-2 border border-border-dim opacity-60">
        <div className="h-7 w-7 rounded-full bg-bg-hover animate-pulse shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="h-3 w-24 bg-bg-hover rounded animate-pulse" />
          <div className="h-2 w-12 bg-bg-hover rounded animate-pulse" />
        </div>
      </div>
    )
  }
  // Show Sign in / Create account when not authed (or loading -> show to avoid FOUC)
  return (
    <nav aria-label="Auth" className="space-y-0.5">
      <Link
        href="/login"
        className={cn(
          "group relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-2",
          pathname === "/login"
            ? "bg-accent-brand/10 font-semibold text-accent-brand"
            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        )}
      >
        {pathname === "/login" && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-accent-brand" />}
        <LogIn className={cn("h-[15px] w-[15px]", pathname === "/login" ? "text-accent-brand" : "text-text-tertiary group-hover:text-text-secondary")} />
        <span>Sign in</span>
      </Link>
      <Link
        href="/register"
        className={cn(
          "group relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-2",
          pathname === "/register"
            ? "bg-accent-brand/10 font-semibold text-accent-brand"
            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        )}
      >
        {pathname === "/register" && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-accent-brand" />}
        <UserPlus className={cn("h-[15px] w-[15px]", pathname === "/register" ? "text-accent-brand" : "text-text-tertiary group-hover:text-text-secondary")} />
        <span>Create account</span>
      </Link>
    </nav>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const [collapsedProfile, setCollapsedProfile] = useState<{ email: string; avatar_url: string | null } | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then(async (r) => {
        if (cancelled) return
        if (r.ok) {
          try {
            const data = await r.json()
            if (data?.user) {
              setCollapsedProfile({ email: data.user.email, avatar_url: data.user.avatar_url ?? null })
            } else {
              setCollapsedProfile(null)
            }
          } catch {
            setCollapsedProfile(null)
          }
        } else {
          setCollapsedProfile(null)
        }
      })
      .catch(() => {
        if (!cancelled) setCollapsedProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [pathname, collapsed])

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {}
    window.location.href = "/login"
  }

  if (collapsed) {
    return (
      <aside className="hidden sm:flex w-[52px] shrink-0 flex-col border-r border-border-default bg-bg-secondary">
        <div className="p-2">
          <button
            onClick={() => setCollapsed(false)}
            className="w-full rounded-lg p-2 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            aria-label="Expand navigation"
          >
            <PanelLeftClose className="h-4 w-4 rotate-180" />
          </button>
        </div>
        {collapsedProfile && (
          <div className="mt-2 flex justify-center px-2">
            {collapsedProfile.avatar_url ? (
              <img
                src={collapsedProfile.avatar_url}
                alt={collapsedProfile.email}
                className="h-8 w-8 rounded-full object-cover border border-border-dim"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-brand/15 text-xs font-semibold text-accent-brand border border-border-dim">
                {collapsedProfile.email ? collapsedProfile.email[0].toUpperCase() : "?"}
              </div>
            )}
          </div>
        )}
      </aside>
    )
  }
  return (
    <aside className="flex h-screen w-full shrink-0 flex-col border-r border-border-default bg-bg-secondary sm:static sm:w-[224px] sm:shrink-0">
      {/* header */}
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-accent-brand">
            <div className="min-w-0">
              <h1 className="truncate text-xl leading-none text-ink" style={{ fontFamily: "Louize, Georgia, serif" }}>
                SeedInfer
              </h1>
              <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-text-tertiary">
                Private inference
              </p>
            </div>
          </Link>
          <button
            aria-label="Collapse navigation"
            onClick={() => setCollapsed(true)}
            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary hidden sm:inline-flex"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border-dim bg-bg-primary/65 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-text-secondary">Public alpha</span>
          </div>
          <span className="font-mono text-[8px] text-text-tertiary">LIVE</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <NavSection title="Use the network" items={useNetwork} />
        <NavSection title="Provide" items={provide} />
        <NavSection title="Build" items={build} />
      </div>

      <div className="border-t border-border-dim px-2.5 py-2 space-y-2">
        <BottomNav />
        <AuthNav />
      </div>

      <div className="flex items-center gap-1 border-t border-border-dim px-3 py-2">
        <p className="flex-1 font-mono text-[8px] uppercase tracking-[0.14em] text-text-tertiary">Community</p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          aria-label="GitHub"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </a>
        <a
          href="#"
          className="rounded-lg p-1.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          aria-label="Slack"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
        </a>
      </div>

      <div className="border-t border-border-dim p-2.5">
        <div className="grid grid-cols-2 gap-1">
          <button className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] text-text-secondary hover:bg-bg-hover">
            <Settings className="h-3 w-3" />
            <span>Appearance</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-end gap-2 rounded-lg px-2 py-2 text-[11px] text-text-secondary hover:bg-accent-red/10 hover:text-accent-red"
          >
            <LogOut className="h-3 w-3" />
            <span>Sign out</span>
          </button>
        </div>
        <p className="mt-1 px-2 font-mono text-[8px] leading-3 text-text-tertiary">
          Public alpha · evaluation use only · SeedInfer
        </p>
      </div>
    </aside>
  )
}

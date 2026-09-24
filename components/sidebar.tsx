"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
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
  PanelLeftOpen,
  FileText,
  LogIn,
  UserPlus,
  LogOut,
  BadgeCheck,
  Menu,
  X,
  Network,
  KeyRound,
  ShieldCheck,
  Scale,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import ThemeToggle from "@/components/theme-toggle"
import { Logo, LogoMark } from "@/components/ui/logo"
import { GITHUB_URL } from "@/lib/catalog"

const COLLAPSE_KEY = "seedinfer_sidebar_collapsed"

type NavItem = { href: string; label: string; icon: React.ElementType }
type NavGroup = { title: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Use",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/chat", label: "Chat", icon: MessageSquare },
      { href: "/models", label: "Models", icon: Cpu },
      { href: "/stats", label: "Network stats", icon: Activity },
    ],
  },
  {
    title: "Build",
    items: [
      { href: "/api-console", label: "API Console", icon: Code2 },
      { href: "/docs", label: "Docs", icon: FileText },
    ],
  },
  {
    title: "Provide",
    items: [
      { href: "/provider", label: "Become a Provider", icon: Server },
      { href: "/provider/portal", label: "Provider Portal", icon: KeyRound },
      { href: "/providers", label: "Providers", icon: Network },
      { href: "/earn", label: "Earnings", icon: Coins },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "Legal",
    items: [
      { href: "/privacy", label: "Privacy Policy", icon: ShieldCheck },
      { href: "/terms", label: "Terms of Service", icon: Scale },
    ],
  },
]

const ALL_HREFS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false
  if (href === "/") return pathname === "/"
  const matches = (h: string) => pathname === h || pathname.startsWith(h + "/")
  if (!matches(href)) return false
  // Prefer the most specific nav item (e.g. /provider/portal over /provider)
  return !ALL_HREFS.some((h) => h !== href && h.length > href.length && h.startsWith(href + "/") && matches(h))
}

/* ------------------------------------------------------------------ auth */

type Profile = { email: string; avatar_url: string | null; balance: number; email_verified: unknown }
type AuthState = { status: "loading" | "authed" | "anon"; profile: Profile | null }

function useAuth(pathname: string | null): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading", profile: null })
  useEffect(() => {
    let cancelled = false
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) return setState({ status: "anon", profile: null })
        try {
          const data = await r.json()
          if (cancelled) return
          if (data?.user) {
            setState({
              status: "authed",
              profile: {
                email: data.user.email,
                avatar_url: data.user.avatar_url ?? null,
                balance: data.credits?.balance_usd ?? 0,
                email_verified: data.user.email_verified,
              },
            })
          } else setState({ status: "anon", profile: null })
        } catch {
          setState({ status: "anon", profile: null })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anon", profile: null })
      })
    return () => {
      cancelled = true
    }
  }, [pathname])
  return state
}

async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
  } catch {}
  window.location.href = "/login"
}

/* ------------------------------------------------------------ nav items */

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-lg text-[13px] transition-colors",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-accent-brand/10 font-medium text-text-primary"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-accent-brand" aria-hidden />}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-accent-brand" : "text-text-tertiary group-hover:text-text-secondary"
        )}
      />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  )
}

function NavGroups({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string | null
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      {NAV_GROUPS.map((g, i) => (
        <nav key={g.title} aria-label={g.title} className={cn(i > 0 && "mt-4")}>
          {collapsed ? (
            i > 0 && <div className="mx-2 mb-3 border-t border-border-dim" aria-hidden />
          ) : (
            <p className="mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{g.title}</p>
          )}
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <NavLink
                key={it.href}
                item={it}
                active={isActivePath(pathname, it.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </nav>
      ))}
    </>
  )
}

function Avatar({ profile, size = "h-7 w-7" }: { profile: Profile; size?: string }) {
  if (profile.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatar_url} alt="" className={cn(size, "shrink-0 rounded-full object-cover")} />
  }
  return (
    <span
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-full bg-accent-brand/15 text-[11px] font-semibold text-accent-brand"
      )}
    >
      {profile.email ? profile.email[0].toUpperCase() : "?"}
    </span>
  )
}

function AccountBlock({ auth, pathname, onNavigate }: { auth: AuthState; pathname: string | null; onNavigate?: () => void }) {
  if (auth.status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-dim px-2.5 py-2">
        <div className="skeleton h-7 w-7 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-2.5 w-24" />
          <div className="skeleton h-2 w-12" />
        </div>
      </div>
    )
  }
  if (auth.status === "authed" && auth.profile) {
    const p = auth.profile
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-dim bg-bg-primary/60 px-2.5 py-2">
        <Avatar profile={p} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium leading-tight text-text-primary">{p.email}</div>
          <div className="font-mono text-[10px] text-text-tertiary">${Number(p.balance).toFixed(2)} credit</div>
        </div>
        {p.email_verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent-green" aria-label="Verified" /> : null}
        <button
          type="button"
          onClick={signOut}
          className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-accent-red/10 hover:text-accent-red"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        href="/login"
        onClick={onNavigate}
        aria-current={pathname === "/login" ? "page" : undefined}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-secondary text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
      >
        <LogIn className="h-3.5 w-3.5" /> Sign in
      </Link>
      <Link
        href="/register"
        onClick={onNavigate}
        aria-current={pathname === "/register" ? "page" : undefined}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-accent-brand text-xs font-medium text-white transition-colors hover:bg-accent-brand-hover"
      >
        <UserPlus className="h-3.5 w-3.5" /> Sign up
      </Link>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

function StatusPill() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border-dim bg-bg-primary/60 px-2.5 py-1.5">
      <span className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Public beta</span>
      </span>
      <span className="font-mono text-[9px] text-text-tertiary">LIVE</span>
    </div>
  )
}

/** Full sidebar body — shared by the desktop aside and the mobile drawer. */
function SidebarBody({
  pathname,
  auth,
  onNavigate,
  headerAction,
}: {
  pathname: string | null
  auth: AuthState
  onNavigate?: () => void
  headerAction?: React.ReactNode
}) {
  return (
    <>
      <div className="px-3 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <Link href="/" onClick={onNavigate} className="min-w-0 rounded-lg" aria-label="SeedInfer home">
            <Logo />
          </Link>
          {headerAction}
        </div>
        <div className="mt-3">
          <StatusPill />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <NavGroups pathname={pathname} onNavigate={onNavigate} />
      </div>

      <div className="space-y-2 border-t border-border-dim p-2.5">
        <AccountBlock auth={auth} pathname={pathname} onNavigate={onNavigate} />
        <div className="flex items-center gap-1">
          <ThemeToggle variant="menu" className="flex-1" />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="SeedInfer on GitHub"
            title="GitHub"
          >
            <GitHubIcon />
          </a>
        </div>
        <p className="px-1 font-mono text-[9px] leading-3 text-text-tertiary">Public beta · evaluation use only</p>
      </div>
    </>
  )
}

/* ---------------------------------------------------------- mobile drawer */

function MobileDrawer({
  open,
  onClose,
  pathname,
  auth,
}: {
  open: boolean
  onClose: () => void
  pathname: string | null
  auth: AuthState
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        id="mobile-nav"
        className="absolute inset-y-0 left-0 flex w-[82vw] max-w-[300px] animate-slide-in-left flex-col border-r border-border-default bg-bg-secondary shadow-2xl"
      >
        <SidebarBody
          pathname={pathname}
          auth={auth}
          onNavigate={onClose}
          headerAction={
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          }
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- sidebar */

/**
 * Responsive app navigation.
 * - < md: sticky top bar (logo + hamburger) + slide-over drawer.
 * - ≥ md: left sidebar, collapsible to an icon rail (persisted).
 * Renders a fragment so it can sit directly inside the page flex container
 * (see the `[data-app-topbar]` rule in app/globals.css) or inside <AppShell>.
 */
export default function Sidebar() {
  const pathname = usePathname()
  const auth = useAuth(pathname)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1")
    } catch {}
  }, [])

  // close the drawer on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1")
      } catch {}
      return !c
    })
  }
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      {/* mobile top bar */}
      <header
        data-app-topbar
        className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-bg-secondary/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-bg-secondary/70 md:hidden"
      >
        <Link href="/" className="rounded-lg" aria-label="SeedInfer home">
          <Logo subtitle={false} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle variant="icon" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <MobileDrawer open={open} onClose={close} pathname={pathname} auth={auth} />

      {/* desktop sidebar */}
      {collapsed ? (
        <aside
          aria-label="Primary"
          className="hidden h-full w-[60px] shrink-0 flex-col border-r border-border-default bg-bg-secondary md:flex"
        >
          <div className="flex flex-col items-center gap-2 px-2 pb-3 pt-4">
            <Link href="/" aria-label="SeedInfer home" className="rounded-lg">
              <LogoMark />
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label="Expand navigation"
              title="Expand navigation"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <NavGroups pathname={pathname} collapsed />
          </div>
          <div className="flex flex-col items-center gap-2 border-t border-border-dim p-2">
            {auth.status === "authed" && auth.profile ? (
              <Link href="/settings" title={auth.profile.email} aria-label="Account settings">
                <Avatar profile={auth.profile} size="h-8 w-8" />
              </Link>
            ) : auth.status === "anon" ? (
              <Link
                href="/login"
                title="Sign in"
                aria-label="Sign in"
                className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <LogIn className="h-4 w-4" />
              </Link>
            ) : null}
            <ThemeToggle variant="icon" />
          </div>
        </aside>
      ) : (
        <aside
          aria-label="Primary"
          className="hidden h-full w-[232px] shrink-0 flex-col border-r border-border-default bg-bg-secondary md:flex"
        >
          <SidebarBody
            pathname={pathname}
            auth={auth}
            headerAction={
              <button
                type="button"
                aria-label="Collapse navigation"
                title="Collapse navigation"
                onClick={toggleCollapsed}
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            }
          />
        </aside>
      )}
    </>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, BadgeCheck, CheckCircle2, Chrome, Download, Github, KeyRound, LogOut, Monitor, Trash2, UserRound } from "lucide-react"
import { oauthErrorMessage } from "@/lib/oauth/messages"

type Link_ = { provider: string; email: string | null; username: string | null; created_at: string; last_login_at: string | null }
type Session_ = { token: string; current: boolean; method: string | null; user_agent: string | null; created_at: string | null; expires_at: string | null }
type Account = {
  user: { id: string; email: string; email_verified: boolean; display_name: string | null; avatar_url: string | null; created_at: string | null; has_password: boolean }
  links: Link_[]
  sessions: Session_[]
  balance_usd_cents: number
}

const PROVIDERS = [
  { id: "google", label: "Google", Icon: Chrome },
  { id: "github", label: "GitHub", Icon: Github },
] as const

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—"
}

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device"
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /curl|node|python/i.test(ua) ? "API client" : "Browser"
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : ""
  return os ? `${browser} · ${os}` : browser
}

async function api(method: "PATCH" | "DELETE", body: unknown): Promise<{ ok: boolean; data: any }> {
  const res = await fetch("/api/v1/account", {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

/** Account management: profile, sign-in methods, sessions, data export and deletion. */
export default function AccountPanel() {
  const [state, setState] = useState<"loading" | "anon" | "ready" | "error">("loading")
  const [acct, setAcct] = useState<Account | null>(null)
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string; reauth?: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [pw, setPw] = useState({ current: "", next: "" })
  const [confirmEmail, setConfirmEmail] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/account", { credentials: "include", cache: "no-store" })
      if (res.status === 401) return setState("anon")
      if (!res.ok) return setState("error")
      const data = (await res.json()) as Account
      setAcct(data)
      setName(data.user.display_name || "")
      setState("ready")
    } catch {
      setState("error")
    }
  }, [])

  useEffect(() => {
    load()
    fetch("/api/auth/providers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.providers && setEnabled(Object.fromEntries(d.providers.map((p: any) => [p.id, !!p.enabled]))))
      .catch(() => {})
    // Result of a "Connect Google/GitHub" round-trip (?linked= / ?error=)
    const q = new URLSearchParams(window.location.search)
    const linked = q.get("linked")
    const error = q.get("error")
    if (linked) setNotice({ kind: "ok", text: `${linked === "github" ? "GitHub" : "Google"} is now linked to your account.` })
    else if (error) setNotice({ kind: "err", text: oauthErrorMessage(error) })
    if (linked || error) window.history.replaceState(null, "", window.location.pathname)
  }, [load])

  const run = async (key: string, method: "PATCH" | "DELETE", body: unknown, okText: string) => {
    setBusy(key)
    setNotice(null)
    const { ok, data } = await api(method, body)
    setBusy(null)
    if (!ok) {
      setNotice({ kind: "err", text: data?.error || "Request failed", reauth: data?.code === "reauth_required" })
      return false
    }
    setNotice({ kind: "ok", text: okText })
    await load()
    return true
  }

  const reauth = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
    window.location.href = "/login?next=/settings"
  }

  const exportData = async () => {
    setBusy("export")
    try {
      const res = await fetch("/api/v1/account?export=1", { credentials: "include", cache: "no-store" })
      if (!res.ok) throw new Error(`export failed (${res.status})`)
      const blob = new Blob([JSON.stringify(await res.json(), null, 2)], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `seedinfer-account-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e: any) {
      setNotice({ kind: "err", text: e?.message || "Export failed" })
    } finally {
      setBusy(null)
    }
  }

  const deleteAccount = async () => {
    setBusy("delete")
    setNotice(null)
    const { ok, data } = await api("DELETE", { confirm_email: confirmEmail })
    setBusy(null)
    if (!ok) return setNotice({ kind: "err", text: data?.error || "Delete failed", reauth: data?.code === "reauth_required" })
    window.location.href = "/"
  }

  if (state === "loading") {
    return <Card className="border border-border-dim bg-bg-secondary"><CardContent className="h-28 animate-pulse p-4" /></Card>
  }
  if (state === "anon" || state === "error" || !acct) {
    return (
      <Card className="border border-border-dim bg-bg-secondary">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <UserRound className="h-4 w-4 text-accent-brand" />
            {state === "error" ? "Could not load your account. Try again in a moment." : "Sign in to manage your profile, sign-in methods and data."}
          </div>
          <Link href="/login?next=/settings" className="rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
            Sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  const u = acct.user
  const linkedBy = Object.fromEntries(acct.links.map((l) => [l.provider, l]))
  const methods = acct.links.length + (u.has_password ? 1 : 0)

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          className={`flex flex-wrap items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-4 ${
            notice.kind === "ok" ? "border-accent-green/20 bg-accent-green/10 text-accent-green" : "border-accent-red/20 bg-accent-red/10 text-accent-red"
          }`}
        >
          {notice.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1">{notice.text}</span>
          {notice.reauth && (
            <button onClick={reauth} className="font-medium underline">
              Sign in again
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card className="border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <UserRound className="h-4 w-4 text-accent-brand" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-3">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-brand/15 font-semibold text-accent-brand">
                  {u.email[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate font-medium text-text-primary">
                  <span className="truncate">{u.email}</span>
                  {u.email_verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent-green" aria-label="Verified email" /> : null}
                </div>
                <div className="font-mono text-[11px] text-text-tertiary">
                  {u.email_verified ? "verified email" : "email not verified"} · member since {fmtDate(u.created_at).slice(0, 10)}
                </div>
              </div>
            </div>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                run("name", "PATCH", { action: "display_name", name }, "Display name saved.")
              }}
            >
              <label className="min-w-[180px] flex-1 space-y-1">
                <span className="font-mono text-[11px] text-text-secondary">Display name</span>
                <Input value={name} maxLength={60} placeholder="How we greet you" onChange={(e) => setName(e.target.value)} />
              </label>
              <Button type="submit" size="sm" disabled={busy === "name" || name === (u.display_name || "")}>
                Save
              </Button>
            </form>
            <div className="flex items-center justify-between rounded-lg border border-border-dim bg-bg-primary px-3 py-2">
              <span className="text-text-secondary">Credit balance</span>
              <Link href="/billing" className="font-mono text-text-primary hover:underline">
                ${(acct.balance_usd_cents / 100).toFixed(2)}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Sign-in methods */}
        <Card className="border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <KeyRound className="h-4 w-4 text-accent-brand" /> Sign-in methods
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {PROVIDERS.map(({ id, label, Icon }) => {
              const l = linkedBy[id]
              return (
                <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-dim bg-bg-primary px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                    <div className="min-w-0">
                      <div className="font-medium text-text-primary">{label}</div>
                      <div className="truncate font-mono text-[11px] text-text-tertiary">
                        {l ? l.username ? `@${l.username}` : l.email || "linked" : enabled[id] === false ? "not available" : "not linked"}
                      </div>
                    </div>
                  </div>
                  {l ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === `unlink-${id}` || methods <= 1}
                      title={methods <= 1 ? "Your only sign-in method — add another one first" : undefined}
                      onClick={() => run(`unlink-${id}`, "PATCH", { action: "unlink", provider: id }, `${label} unlinked.`)}
                    >
                      Unlink
                    </Button>
                  ) : enabled[id] ? (
                    <a
                      href={`/api/auth/login/${id}?link=1&next=/settings`}
                      className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 font-medium text-text-primary hover:bg-bg-hover"
                    >
                      Connect
                    </a>
                  ) : null}
                </div>
              )
            })}
            <form
              className="space-y-2 rounded-lg border border-border-dim bg-bg-primary px-3 py-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const done = await run(
                  "pw",
                  "PATCH",
                  { action: "set_password", password: pw.next, current: pw.current },
                  u.has_password ? "Password changed. Other sessions were signed out." : "Password set. You can now also sign in with email and password."
                )
                if (done) setPw({ current: "", next: "" })
              }}
            >
              <div className="font-medium text-text-primary">Password</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {u.has_password && (
                  <Input type="password" autoComplete="current-password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                )}
                <Input type="password" autoComplete="new-password" minLength={8} placeholder={u.has_password ? "New password (min 8)" : "Set a password (min 8)"} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </div>
              <Button type="submit" size="sm" disabled={busy === "pw" || pw.next.length < 8 || (u.has_password && !pw.current)}>
                {u.has_password ? "Change password" : "Set password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card className="border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <Monitor className="h-4 w-4 text-accent-brand" /> Active sessions
              <Badge variant="outline" className="font-mono text-[10px]">{acct.sessions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {acct.sessions.map((s) => (
              <div key={s.token} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-dim bg-bg-primary px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium text-text-primary">{describeAgent(s.user_agent)}</div>
                  <div className="font-mono text-[11px] text-text-tertiary">
                    {s.method || "sign-in"} · since {fmtDate(s.created_at)}
                  </div>
                </div>
                {s.current && <Badge variant="success">this device</Badge>}
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "signout" || acct.sessions.length <= 1}
              onClick={() => run("signout", "PATCH", { action: "signout_others" }, "Signed out of all other sessions.")}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out other sessions
            </Button>
          </CardContent>
        </Card>

        {/* Your data */}
        <Card className="border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <Download className="h-4 w-4 text-accent-brand" /> Your data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-text-secondary">
            <p className="leading-5">
              Download everything we store about your account (profile, sign-in methods, sessions, credits, invoices, usage) as JSON. See the{" "}
              <Link href="/privacy" className="text-accent-brand underline">privacy policy</Link>.
            </p>
            <Button size="sm" variant="outline" disabled={busy === "export"} onClick={exportData}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download my data
            </Button>
            <div className="space-y-2 rounded-lg border border-accent-red/20 bg-accent-red/5 p-3">
              <div className="flex items-center gap-1.5 font-medium text-accent-red">
                <Trash2 className="h-3.5 w-3.5" /> Delete account
              </div>
              <p className="leading-5">
                Permanently deletes your profile, sign-in methods, sessions, credits
                {acct.balance_usd_cents > 0 ? ` (including your $${(acct.balance_usd_cents / 100).toFixed(2)} balance)` : ""} and invoices. Usage records
                are kept without any link to you. Type your email to confirm.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-[200px] flex-1" placeholder={u.email} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
                <Button
                  size="sm"
                  variant="outline"
                  className="border-accent-red/40 text-accent-red hover:bg-accent-red/10"
                  disabled={busy === "delete" || confirmEmail.trim().toLowerCase() !== u.email.toLowerCase()}
                  onClick={deleteAccount}
                >
                  Delete permanently
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

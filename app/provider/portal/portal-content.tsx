"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer, SectionHeader } from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  KeyRound,
  LogIn,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react"
import {
  PROVIDER_ECONOMICS,
  REVENUE_SHARE_PCT,
  PROTOCOL_FEE_PCT,
  STANDBY_LABEL,
  PAYOUT_LABEL,
} from "@/lib/catalog"

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const STANDBY_PCT = Math.round(PROVIDER_ECONOMICS.standbyMinUptime * 100)
const INSTALL_CANONICAL = "curl -fsSL https://seedinfer.com/install.sh | SEEDINFER_NODE_TOKEN=sipn_… bash"
const INSTALL_ALT = "curl -fsSL https://seedinfer.com/install.sh | bash -s -- --token sipn_…"
const LOGIN_NEXT = "/login?next=/provider/portal"

type ApiError = { error?: string; code?: string }

type WalletInfo = {
  wallet: string | null
  updated_at: string | null
  chain: string
  asset: string
  min_payout_usd: number
}

type NodeToken = {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

type CreatedToken = { id: string; name: string; secret: string }

type AccountNode = {
  id: string
  status: string | null
  online: boolean
  last_heartbeat: string | null
  bound_at: string | null
  token_prefix: string | null
  model: string | null
  gpu: string | null
  region: string | null
  country_code: string | null
  agent_version: string | null
  heartbeat_count: number
  total_requests: number
}

async function readBody<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T
}

async function reauth() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
  window.location.href = LOGIN_NEXT
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? `${d.toISOString().slice(0, 16).replace("T", " ")} UTC` : "—"
}

function timeAgo(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "never"
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return "—"
  const s = Math.max(0, Math.floor((nowMs - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {}
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1 font-mono text-[11px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* a) Payout wallet                                                    */
/* ------------------------------------------------------------------ */

function PayoutWalletCard({ mounted, nowMs }: { mounted: boolean; nowMs: number }) {
  const [info, setInfo] = useState<WalletInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/v1/account/payout-wallet", { credentials: "include", cache: "no-store" })
      if (res.status === 401) {
        window.location.href = LOGIN_NEXT
        return
      }
      const data = await readBody<WalletInfo & ApiError>(res)
      if (!res.ok) {
        setLoadError(data.error || `Could not load payout wallet (${res.status}).`)
        return
      }
      setInfo(data)
    } catch {
      setLoadError("Network error — could not load payout wallet.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNeedsReauth(false)
    setSaved(false)
    const v = input.trim()
    if (!EVM_ADDRESS_RE.test(v)) {
      setError(`Enter a valid EVM address on ${PROVIDER_ECONOMICS.payoutChain} (0x followed by 40 hex characters).`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/v1/account/payout-wallet", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: v }),
      })
      const data = await readBody<WalletInfo & ApiError>(res)
      if (!res.ok) {
        if (data.code === "reauth_required") {
          setNeedsReauth(true)
          return
        }
        if (data.code === "invalid_wallet") {
          setError("That address was rejected (not a valid EVM address). Double-check it and try again.")
          return
        }
        if (data.code === "rate_limited") {
          setError("Too many changes — try again later.")
          return
        }
        if (data.code === "forbidden_origin") {
          setError("Request blocked by the origin check. Reload the page and try again.")
          return
        }
        setError(data.error || `Save failed (${res.status}). Try again.`)
        return
      }
      setInfo(data)
      setInput("")
      setSaved(true)
    } catch {
      setError("Network error — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-border-dim bg-bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-accent-brand" aria-hidden="true" /> Payout wallet ({PROVIDER_ECONOMICS.payoutAsset} on{" "}
          {PROVIDER_ECONOMICS.payoutChain})
        </CardTitle>
        <CardDescription className="font-mono text-xs text-text-secondary">
          Payouts are sent only as {PROVIDER_ECONOMICS.payoutAsset} on {PROVIDER_ECONOMICS.payoutChain}. Minimum $
          {(info?.min_payout_usd ?? PROVIDER_ECONOMICS.minPayoutUsd).toFixed(2)} — smaller balances carry over.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-bg-tertiary" />
        ) : loadError ? (
          <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-accent-amber" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{loadError}</span>
            <button type="button" onClick={load} className="shrink-0 font-medium underline">
              Retry
            </button>
          </div>
        ) : info?.wallet ? (
          <div className="flex items-start gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 p-3 font-mono text-xs text-accent-green">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] opacity-80">Registered payout wallet:</span>
              <code className="block break-all text-text-primary">{info.wallet}</code>
              <span className="block text-[11px] opacity-80">
                Last changed: {mounted ? fmtDateTime(info.updated_at) : "…"}
              </span>
            </span>
            <CopyButton text={info.wallet} />
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-text-secondary">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" aria-hidden="true" />
            <p className="min-w-0 text-[11px] leading-4">
              <span className="font-bold text-accent-amber">No payout wallet yet:</span> your earnings keep accruing, but
              payouts can&apos;t be sent without a registered {PROVIDER_ECONOMICS.payoutChain} address.
            </p>
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 p-3 font-mono text-xs text-accent-green" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Payout wallet saved.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-accent-amber" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        {needsReauth && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-accent-amber" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              For security, sign in again (sessions older than 15 minutes can&apos;t change the payout wallet).
            </span>
            <Button type="button" size="sm" onClick={reauth}>
              Sign in again
            </Button>
          </div>
        )}

        {!loading && !loadError && (
          <form onSubmit={onSubmit} className="space-y-3 font-mono text-xs">
            <div className="space-y-1.5">
              <label htmlFor="portal-wallet" className="font-semibold text-text-secondary">
                {info?.wallet ? "New" : ""} {PROVIDER_ECONOMICS.payoutChain} wallet address ({PROVIDER_ECONOMICS.payoutAsset})
              </label>
              <Input
                id="portal-wallet"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                className="border-border-dim bg-bg-tertiary font-mono text-xs"
              />
            </div>
            <Button type="submit" disabled={saving} className="bg-accent-brand text-xs font-semibold text-white hover:bg-accent-brand-hover">
              <Wallet className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> {saving ? "Saving…" : info?.wallet ? "Update payout wallet" : "Register payout wallet"}
            </Button>
          </form>
        )}
        <p className="font-mono text-[11px] leading-4 text-text-tertiary">
          Changes are recorded in your account security log.
        </p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* b) Node tokens                                                      */
/* ------------------------------------------------------------------ */

function NodeTokensCard({ mounted }: { mounted: boolean }) {
  const [tokens, setTokens] = useState<NodeToken[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState("node")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<CreatedToken | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/v1/account/node-tokens", { credentials: "include", cache: "no-store" })
      if (res.status === 401) {
        window.location.href = LOGIN_NEXT
        return
      }
      const data = await readBody<{ tokens?: NodeToken[] } & ApiError>(res)
      if (!res.ok || !Array.isArray(data.tokens)) {
        setLoadError(data.error || `Could not load tokens (${res.status}).`)
        return
      }
      setTokens(data.tokens)
    } catch {
      setLoadError("Network error — could not load tokens.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim() || "node"
    if (trimmed.length > 48) {
      setError("Token name must be at most 48 characters.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/v1/account/node-tokens", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await readBody<{ token?: { id: string; name: string }; secret?: string } & ApiError>(res)
      if (!res.ok || !data.secret || !data.token) {
        if (data.code === "token_limit") {
          setError("Token limit reached (20 active tokens). Revoke a token you no longer use, then try again.")
          return
        }
        if (data.code === "rate_limited") {
          setError("Too many tokens created recently — try again later.")
          return
        }
        setError(data.error || `Could not create token (${res.status}).`)
        return
      }
      setJustCreated({ id: data.token.id, name: data.token.name, secret: data.secret })
      setName("node")
      await load()
    } catch {
      setError("Network error — try again.")
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    setRevoking(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/account/node-tokens/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await readBody<ApiError>(res)
      if (!res.ok && res.status !== 404) {
        setError(data.error || `Could not revoke token (${res.status}).`)
        return
      }
      setConfirmRevoke(null)
      await load()
    } catch {
      setError("Network error — try again.")
    } finally {
      setRevoking(false)
    }
  }

  const fullInstallCmd = justCreated
    ? `curl -fsSL https://seedinfer.com/install.sh | SEEDINFER_NODE_TOKEN=${justCreated.secret} bash`
    : ""

  return (
    <Card className="border border-border-dim bg-bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-accent-brand" aria-hidden="true" /> Node tokens
        </CardTitle>
        <CardDescription className="font-mono text-xs text-text-secondary">
          One token per node — pass it to the installer. Tokens never expire and can be revoked at any time (max 20
          active).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {justCreated && (
          <div className="space-y-2 rounded-lg border border-accent-brand/40 bg-accent-brand/10 p-3">
            <div className="flex items-start gap-2 font-mono text-xs text-text-primary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" aria-hidden="true" />
              <p className="min-w-0 text-[11px] leading-4 text-text-secondary">
                <span className="font-bold text-accent-brand">Token created — copy it now.</span> This token
                won&apos;t be shown again. If you lose it, revoke it and create a new one.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-bg-primary px-2 py-1.5 font-mono text-xs text-text-primary">
                {justCreated.secret}
              </code>
              <CopyButton text={justCreated.secret} label="Copy token" />
            </div>
            <div className="space-y-1.5">
              <div className="font-mono text-[11px] text-text-tertiary">Install command with this token:</div>
              <div className="flex flex-wrap items-center gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-bg-primary px-2 py-1.5 font-mono text-[11px] leading-4 text-text-secondary">
                  {fullInstallCmd}
                </pre>
                <CopyButton text={fullInstallCmd} label="Copy command" />
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setJustCreated(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-accent-amber" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={create} className="flex flex-wrap items-end gap-2 font-mono text-xs">
          <label htmlFor="token-name" className="min-w-[160px] flex-1 space-y-1.5">
            <span className="font-semibold text-text-secondary">New token name</span>
            <Input
              id="token-name"
              value={name}
              maxLength={48}
              onChange={(e) => setName(e.target.value)}
              placeholder="node"
              autoComplete="off"
              className="border-border-dim bg-bg-tertiary font-mono text-xs"
            />
          </label>
          <Button type="submit" disabled={creating} size="sm">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> {creating ? "Creating…" : "Create token"}
          </Button>
        </form>

        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-bg-tertiary" />
        ) : loadError ? (
          <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-accent-amber" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{loadError}</span>
            <button type="button" onClick={load} className="shrink-0 font-medium underline">
              Retry
            </button>
          </div>
        ) : !tokens || tokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-3 font-mono text-xs text-text-secondary">
            No tokens yet — create one above, then run the installer on your GPU machine.
          </div>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-dim bg-bg-primary px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-xs font-medium text-text-primary">{t.name}</span>
                    {t.revoked_at ? (
                      <Badge variant="outline" className="font-mono text-[10px]">Revoked</Badge>
                    ) : (
                      <Badge variant="success" className="font-mono text-[10px]">Active</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 break-all font-mono text-[11px] text-text-tertiary">
                    <code className="break-all">{t.prefix}…</code> · created {mounted ? fmtDateTime(t.created_at) : "…"} ·
                    last used {mounted ? timeAgo(t.last_used_at, mounted ? Date.now() : 0) : "…"}
                  </div>
                </div>
                {!t.revoked_at &&
                  (confirmRevoke === t.id ? (
                    <span className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-text-secondary">Revoke this token?</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRevoke(null)} disabled={revoking}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="border-accent-red/40 bg-accent-red/10 text-accent-red hover:bg-accent-red/20"
                        onClick={() => revoke(t.id)}
                        disabled={revoking}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Confirm revoke
                      </Button>
                    </span>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRevoke(t.id)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Revoke
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
        <p className="font-mono text-[11px] leading-4 text-text-tertiary">
          Token creation and revocation are recorded in your account security log.
        </p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* c) Your nodes                                                       */
/* ------------------------------------------------------------------ */

function NodesCard({ mounted, nowMs }: { mounted: boolean; nowMs: number }) {
  const [nodes, setNodes] = useState<AccountNode[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/v1/account/nodes", { credentials: "include", cache: "no-store" })
      if (res.status === 401) {
        window.location.href = LOGIN_NEXT
        return
      }
      const data = await readBody<{ nodes?: AccountNode[] } & ApiError>(res)
      if (!res.ok || !Array.isArray(data.nodes)) {
        setLoadError(data.error || `Could not load nodes (${res.status}).`)
        return
      }
      setNodes(data.nodes)
    } catch {
      setLoadError("Network error — could not load nodes.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card className="border border-border-dim bg-bg-secondary">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Server className="h-4 w-4 text-accent-brand" aria-hidden="true" /> Your nodes
            {nodes && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {nodes.length}
              </Badge>
            )}
          </CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 font-mono text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
          </Button>
        </div>
        <CardDescription className="font-mono text-xs text-text-secondary">
          A node binds to your account on its first heartbeat using the token it was started with. A node id already
          bound to another account is rejected (set PROVIDER_ID to change it).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && !nodes ? (
          <div className="h-20 animate-pulse rounded-lg bg-bg-tertiary" />
        ) : loadError ? (
          <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-accent-amber" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{loadError}</span>
            <button type="button" onClick={load} className="shrink-0 font-medium underline">
              Retry
            </button>
          </div>
        ) : !nodes || nodes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-3 font-mono text-xs text-text-secondary">
            No nodes yet — create a token and run the installer.
          </div>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {nodes.map((n) => (
              <li key={n.id} className="min-w-0 rounded-lg border border-border-dim bg-bg-primary px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs font-semibold text-text-primary">{n.id}</code>
                  {n.online ? (
                    <Badge variant="success" className="font-mono text-[10px]">Online</Badge>
                  ) : (
                    <Badge variant="outline" className="font-mono text-[10px]">Offline</Badge>
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] leading-4 text-text-tertiary">
                  Last heartbeat: {mounted ? timeAgo(n.last_heartbeat, nowMs) : "…"}
                </div>
                <div className="mt-0.5 break-all font-mono text-[11px] leading-4 text-text-tertiary">
                  {[n.model, n.gpu, n.region].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                  {(mounted ? (n.total_requests ?? 0).toLocaleString("en-US") : String(n.total_requests ?? 0))} requests
                  served
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Public info (logged-out)                                            */
/* ------------------------------------------------------------------ */

function EarningsCard() {
  return (
    <Card className="border border-border-dim bg-bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="h-4 w-4 text-accent-green" aria-hidden="true" /> How earnings are calculated
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 font-mono text-xs leading-5 text-text-secondary">
        <div className="space-y-1 rounded-lg border border-border-dim bg-bg-tertiary p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Zap className="h-3.5 w-3.5 text-accent-amber" aria-hidden="true" /> 1. Standby retainer
          </div>
          <p className="text-[11px] text-text-tertiary">
            ${PROVIDER_ECONOMICS.standbyPerDayUsd.toFixed(2)} per node per day with ≥{STANDBY_PCT}% uptime, so a node
            that is online but idle still covers part of its electricity.
          </p>
        </div>
        <div className="space-y-1 rounded-lg border border-border-dim bg-bg-tertiary p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Coins className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" /> 2. {REVENUE_SHARE_PCT}% revenue share
          </div>
          <p className="text-[11px] text-text-tertiary">
            {REVENUE_SHARE_PCT}% of the token revenue your node serves is yours; {PROTOCOL_FEE_PCT}% is the protocol fee
            that funds the gateway and development.
          </p>
        </div>
        <div className="space-y-1 rounded-lg border border-border-dim bg-bg-tertiary p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Wallet className="h-3.5 w-3.5 text-accent-brand" aria-hidden="true" /> 3. Payouts
          </div>
          <p className="text-[11px] text-text-tertiary">
            {PAYOUT_LABEL}. Smaller balances carry over to the next month. No fiat or card payouts.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline" className="font-mono text-[10px]">
            {STANDBY_LABEL}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            No slashing for downtime
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function InstallCard() {
  return (
    <Card className="border border-border-dim bg-bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Server className="h-3.5 w-3.5 text-accent-brand" aria-hidden="true" /> How it works
        </CardTitle>
        <CardDescription className="font-mono text-xs text-text-secondary">
          Sign in, create a node token in this portal, and pass it to the installer on your GPU machine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-1.5 pl-5 font-mono text-xs leading-5 text-text-secondary">
          <li>
            <Link href={LOGIN_NEXT} className="font-medium text-accent-brand underline">
              Sign in
            </Link>{" "}
            and create a node token below (sign-in required).
          </li>
          <li>Run the installer with the token on an NVIDIA GPU with at least 32GB VRAM.</li>
          <li>The node binds to your account on its first heartbeat and starts serving.</li>
        </ol>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-xs leading-4 text-text-primary">
              {INSTALL_CANONICAL}
            </pre>
            <CopyButton text={INSTALL_CANONICAL} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-xs leading-4 text-text-secondary">
              {INSTALL_ALT}
            </pre>
            <CopyButton text={INSTALL_ALT} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PortalContent() {
  const [auth, setAuth] = useState<"loading" | "out" | "in">("loading")
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setMounted(true)
    setNowMs(Date.now())
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include", cache: "no-store" })
        if (!cancelled) setAuth(res.ok ? "in" : "out")
      } catch {
        if (!cancelled) setAuth("out")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppShell>
      <PageHeader
        title="Provider Portal"
        description={<>Node tokens · payout wallet · {REVENUE_SHARE_PCT}% revenue share + standby retainer</>}
        actions={
          auth === "out" ? (
            <Link
              href={LOGIN_NEXT}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-brand-hover"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in
            </Link>
          ) : (
            <Link
              href="/provider"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-brand-hover"
            >
              <Server className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden sm:inline">Become a Provider</span>
              <span className="sm:hidden">Join</span>
            </Link>
          )
        }
      />
      <PageContainer>
        {auth === "loading" && <Card className="border border-border-dim bg-bg-secondary"><CardContent className="h-28 animate-pulse p-4" /></Card>}

        {auth === "out" && (
          <>
            <SectionHeader
              eyebrow="Provider portal"
              title="Manage your nodes and payouts"
              description="Sign in to create node tokens, monitor your nodes and register your payout wallet."
            />
            <Card className="border border-accent-brand/30 bg-gradient-to-r from-bg-secondary via-bg-tertiary/40 to-bg-secondary">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent-brand/20 bg-accent-brand/10 text-accent-brand">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 text-sm text-text-secondary">
                    <strong className="text-text-primary">Sign in to manage your nodes and payouts</strong>
                    <span className="block font-mono text-xs text-text-tertiary">
                      Node tokens, node status and your {PROVIDER_ECONOMICS.payoutAsset} wallet live behind your
                      account.
                    </span>
                  </p>
                </div>
                <Link
                  href={LOGIN_NEXT}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-brand-hover"
                >
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in
                </Link>
              </CardContent>
            </Card>
            <div className="grid gap-6 lg:grid-cols-2">
              <InstallCard />
              <EarningsCard />
            </div>
          </>
        )}

        {auth === "in" && (
          <>
            <SectionHeader
              eyebrow="Your account"
              title="Nodes & payouts"
              description="Tokens, nodes and payout wallet for your signed-in account."
            />
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <PayoutWalletCard mounted={mounted} nowMs={nowMs} />
              <NodeTokensCard mounted={mounted} />
            </div>
            <NodesCard mounted={mounted} nowMs={nowMs} />
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}

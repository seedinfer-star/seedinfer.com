"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer, SectionHeader } from "@/components/app-shell"
import NodeLoginDashboard from "@/components/node-login-dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Coins, KeyRound, Lock, Mail, Server, ShieldCheck, Wallet, Zap } from "lucide-react"
import {
  PROVIDER_ECONOMICS,
  REVENUE_SHARE_PCT,
  PROTOCOL_FEE_PCT,
  STANDBY_LABEL,
  PAYOUT_LABEL,
} from "@/lib/catalog"

const CONTACT_EMAIL = "seedinfer@gmail.com"
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const STANDBY_PCT = Math.round(PROVIDER_ECONOMICS.standbyMinUptime * 100)

function readPubkeyCookie(): string {
  if (typeof document === "undefined") return ""
  const c = document.cookie.split("; ").find((x) => x.startsWith("seedinfer_provider_pubkey="))
  return c ? decodeURIComponent(c.split("=")[1] || "") : ""
}

function PayoutWalletForm() {
  const [publicKey, setPublicKey] = useState("")
  const [wallet, setWallet] = useState("")
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  const loadSaved = async (pk: string) => {
    if (!pk.trim()) {
      setSaved(null)
      return
    }
    try {
      const res = await fetch(`/api/v1/providers/payout-wallet?public_key=${encodeURIComponent(pk.trim())}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      setSaved(typeof data?.payout_wallet === "string" && EVM_ADDRESS_RE.test(data.payout_wallet) ? data.payout_wallet : null)
    } catch {
      setSaved(null)
    }
  }

  useEffect(() => {
    const pk = readPubkeyCookie()
    if (pk) {
      setPublicKey(pk)
      loadSaved(pk)
    }
  }, [])

  const mailtoFallback = () => {
    const subject = encodeURIComponent("SeedInfer payout wallet registration")
    const body = encodeURIComponent(
      `Node public key: ${publicKey.trim()}\n` +
        `Payout wallet (${PROVIDER_ECONOMICS.payoutAsset} on ${PROVIDER_ECONOMICS.payoutChain}): ${wallet.trim()}\n\n` +
        `Please register this address for my node's payouts.`,
    )
    setSent(true)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!publicKey.trim()) {
      setError("Enter your node public key (SEEDINFER_PUBLIC_KEY).")
      return
    }
    if (!EVM_ADDRESS_RE.test(wallet.trim())) {
      setError(`Enter a valid EVM address on ${PROVIDER_ECONOMICS.payoutChain} (0x followed by 40 hex characters).`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/v1/providers/payout-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_key: publicKey.trim(), wallet: wallet.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.error?.code === "provider_not_found") {
          // Node never sent a heartbeat (or gateway restarted) — fall back to email registration.
          mailtoFallback()
          return
        }
        setError(data?.error?.message || `Save failed (${res.status}). Try again or register by email below.`)
        return
      }
      setSaved(String(data.payout_wallet))
      setWallet("")
      setSent(false)
    } catch {
      setError("Network error — try again, or register by email below.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-border-dim bg-bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-accent-brand" /> Payout wallet
        </CardTitle>
        <CardDescription className="font-mono text-xs text-text-secondary">
          Payouts are sent only as {PROVIDER_ECONOMICS.payoutAsset} on {PROVIDER_ECONOMICS.payoutChain}. Register the EVM address that should
          receive your node&apos;s earnings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-accent-brand/40 bg-accent-brand/10 p-3 font-mono text-xs text-text-primary">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" aria-hidden="true" />
          <p className="text-[11px] leading-4 text-text-secondary">
            <span className="font-bold text-accent-brand">Required for payouts:</span> without a registered {PROVIDER_ECONOMICS.payoutChain} address,
            earnings keep accruing but cannot be paid out. Saving here registers the wallet immediately; if your node has not sent a heartbeat
            yet, the form opens a pre-filled email to {CONTACT_EMAIL} instead.
          </p>
        </div>

        {saved && (
          <div className="flex items-start gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 p-3 font-mono text-xs text-accent-green">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              Registered payout wallet: <code className="break-all">{saved}</code>
              <span className="block text-[11px] opacity-80">Visible in the public API next to your node — verify it after saving.</span>
            </span>
          </div>
        )}
        {sent && !error && !saved && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 p-3 font-mono text-xs text-accent-green">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Your node has not sent a heartbeat yet, so the wallet was not saved here. Email draft opened — send your public key and wallet address to {CONTACT_EMAIL}.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 font-mono text-xs text-accent-amber" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3 font-mono text-xs">
          <div className="space-y-1.5">
            <label htmlFor="portal-pubkey" className="font-semibold text-text-secondary">
              Node public key
            </label>
            <Input
              id="portal-pubkey"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="SEEDINFER_PUBLIC_KEY"
              autoComplete="off"
              className="border-border-dim bg-bg-tertiary font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="portal-wallet" className="font-semibold text-text-secondary">
              {PROVIDER_ECONOMICS.payoutChain} wallet address ({PROVIDER_ECONOMICS.payoutAsset})
            </label>
            <Input
              id="portal-wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              className="border-border-dim bg-bg-tertiary font-mono text-xs"
            />
          </div>
          <Button type="submit" disabled={saving} className="bg-accent-brand text-xs font-semibold text-white hover:bg-accent-brand-hover">
            <Mail className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> {saving ? "Saving…" : saved ? "Update payout wallet" : "Register payout wallet"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function PortalContent() {
  return (
    <AppShell>
      <PageHeader
        title="Provider Portal"
        description={<>Node status by public key · payout wallet · {REVENUE_SHARE_PCT}% revenue share + standby retainer</>}
        actions={
          <Link
            href="/provider"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-brand-hover"
          >
            <Server className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Become a Provider</span>
            <span className="sm:hidden">Join</span>
          </Link>
        }
      />
      <PageContainer>
        <SectionHeader
          eyebrow="Your node"
          title="Node status"
          description="Look up your node with its public key. The portal never needs your private key."
        />
        <NodeLoginDashboard />

        <div className="grid gap-6 lg:grid-cols-2">
          <PayoutWalletForm />

          <Card className="border border-border-dim bg-bg-secondary">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Coins className="h-4 w-4 text-accent-green" /> How earnings are calculated
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-xs leading-5 text-text-secondary">
              <div className="space-y-1 rounded-lg border border-border-dim bg-bg-tertiary p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                  <Zap className="h-3.5 w-3.5 text-accent-amber" aria-hidden="true" /> 1. Standby retainer
                </div>
                <p className="text-[11px] text-text-tertiary">
                  ${PROVIDER_ECONOMICS.standbyPerDayUsd.toFixed(2)} per node per day with ≥{STANDBY_PCT}% uptime, so a node that is online but idle
                  still covers part of its electricity.
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border-dim bg-bg-tertiary p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                  <Coins className="h-3.5 w-3.5 text-accent-green" aria-hidden="true" /> 2. {REVENUE_SHARE_PCT}% revenue share
                </div>
                <p className="text-[11px] text-text-tertiary">
                  {REVENUE_SHARE_PCT}% of the token revenue your node serves is yours; {PROTOCOL_FEE_PCT}% is the protocol fee that funds the gateway
                  and development.
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
        </div>

        <Card className="border border-border-dim bg-bg-tertiary/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <ShieldCheck className="h-3.5 w-3.5 text-accent-brand" /> How node keys work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs leading-5 text-text-tertiary">
            <p className="flex gap-2">
              <KeyRound className="mt-1 h-3.5 w-3.5 shrink-0 text-accent-brand" aria-hidden="true" />
              <span>
                <strong className="text-text-primary">Public key</strong> (<code className="rounded bg-bg-secondary px-1">SEEDINFER_PUBLIC_KEY</code>)
                identifies your node on the network. It is created by <code className="rounded bg-bg-secondary px-1">install.sh</code> on first start
                and is safe to share.
              </span>
            </p>
            <p className="flex gap-2">
              <Lock className="mt-1 h-3.5 w-3.5 shrink-0 text-accent-amber" aria-hidden="true" />
              <span>
                <strong className="text-text-primary">Private key</strong> signs your node&apos;s heartbeats. It stays on your machine in{" "}
                <code className="rounded bg-bg-secondary px-1">seedinfer.env</code> (0600 permissions). SeedInfer will never ask for it — do not paste it
                into any website.
              </span>
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  )
}

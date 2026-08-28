"use client"
import { useState } from "react"
import Sidebar from "@/components/sidebar"
import Calculator from "@/components/calculator"
import NodeLoginDashboard from "@/components/node-login-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Server,
  Coins,
  Cpu,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Download,
  KeyRound,
  RefreshCw,
  Activity,
  HardDrive,
  Clock,
  BadgeCheck,
  FileText,
  Zap,
  Globe,
  Fingerprint,
  Lock,
  Key,
  Shield,
  Layers,
  CheckCircle,
  ArrowUpRight,
  Calculator as CalculatorIcon,
} from "lucide-react"

const ONE_LINER_RECOMMENDED = `curl -fsSL https://seedinfer.com/install.sh | bash`
const ONE_LINER_SIMPLE = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey YOUR_AUTHKEY`
const ONE_LINER_AUTO = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey $(curl -s https://seedinfer.com/api/v1/auth/request | jq -r .authkey)`
const ONE_LINER_CUSTOM = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey YOUR_AUTHKEY --model seedinfer/nemotron-lightning-1m --gateway https://seedinfer.com --hostname provider-5090`

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1.5 font-mono text-[11px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
      title={label || "Copy"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label || "Copy"}
    </button>
  )
}

export default function ProviderPage() {
  const [authKey, setAuthKey] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authMeta, setAuthMeta] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const generateKey = async () => {
    setAuthLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/v1/auth/request`, { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || j?.hint || "Failed to generate key")
      setAuthKey(j.authkey)
      setAuthMeta(j)
    } catch (e: any) {
      setError(e?.message || "Failed to generate key")
    } finally {
      setAuthLoading(false)
    }
  }

  const oneLinerWithKey = authKey
    ? `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey ${authKey}`
    : ONE_LINER_SIMPLE

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Become a Provider</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              Earn per token · RTX 5090 32GB · NVFP4 · 1M ctx · CUDA 13.3 · Tailnet seedinfer.ts.net
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/v1/providers"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <Activity className="h-3.5 w-3.5" /> /api/v1/providers
            </a>
            <a
              href="/earn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover transition-colors"
            >
              <Coins className="h-3.5 w-3.5" /> Earnings
            </a>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-5">

            {/* Real-World Hardware Economics & Provider Revenue & Net-Profit Calculator */}
            <Calculator />

            {/* Hero Card */}
            <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary shadow-md">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="success" className="gap-1 font-mono text-[10px]">
                        <BadgeCheck className="h-3 w-3" /> Flagship: Gemma 4 26B A4B
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                        Zero-Account Ed25519 Auth
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Hardware Fingerprint Lock
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        CUDA 13.3 · Driver 580+
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] border-accent-green/30 text-accent-green">
                        Fair Monthly Waterfall Settlement
                      </Badge>
                    </div>

                    <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                      Become a Node Operator — High-Yield GPU Monetization
                    </h2>
                    
                    <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-5 text-text-secondary">
                      Serve flagship <code className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-xs text-text-primary">google/gemma-4-26b-a4b-nvfp4</code> & <code className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-xs text-text-primary">seedinfer/nemotron-lightning-1m</code> models on your RTX 5090 32GB rig. 
                      No account registration needed — automated Ed25519 key generation and hardware-bound identity protection in seconds.
                      Fair monthly settlement model: <strong className="text-text-primary">$0.40/day standby coverage</strong> (for &ge;50% uptime since joining) to cover electricity + <strong className="text-text-primary">network surplus profit share from processed traffic</strong>. Automated USDC payouts on Base network.
                    </p>

                    <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Clock className="h-3 w-3 text-accent-brand" /> Standby Electricity Cover
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">$0.40 / day</div>
                        <div className="font-mono text-[10px] text-text-tertiary">$0.01667/h (after completed hour, uptime &ge;50%)</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Coins className="h-3 w-3 text-accent-green" /> Profit Sharing
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">Proportional Share</div>
                        <div className="font-mono text-[10px] text-text-tertiary">from net revenue based on processed volume and model rates</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Cpu className="h-3 w-3 text-accent-brand" /> Context & Hardware
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">1M · RTX 5090 32GB</div>
                        <div className="font-mono text-[10px] text-text-tertiary">NVFP4 W4A16+FP8 KV ~22-28GB VRAM</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href="#install"
                        className="inline-flex items-center gap-2 rounded-xl bg-accent-brand px-4 py-2 text-xs font-medium text-white hover:bg-accent-brand-hover transition-colors"
                      >
                        <Terminal className="h-4 w-4" /> One-liner install
                      </a>
                      <a
                        href="/provider.tar.gz"
                        className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-xs font-medium text-text-primary hover:bg-bg-hover transition-colors"
                      >
                        <Download className="h-4 w-4" /> provider.tar.gz
                      </a>
                      <a
                        href="https://seedinfer.com/install.sh"
                        target="_blank"
                        className="inline-flex items-center gap-1 font-mono text-xs text-text-tertiary hover:text-text-primary transition-colors"
                      >
                        https://seedinfer.com/install.sh <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Quick Requirements Summary */}
                  <Card className="w-full shrink-0 border border-border-dim bg-bg-primary/70 lg:w-[360px]">
                    <CardHeader className="pb-2 pt-3 px-3.5">
                      <CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                        <ShieldCheck className="h-3 w-3" /> Minimum Node Requirements
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 px-3.5 pb-3">
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2 py-1.5">
                          <span className="text-text-tertiary">OS</span>
                          <span className="font-semibold text-text-primary">Ubuntu 24.04+</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2 py-1.5">
                          <span className="text-text-tertiary">Driver</span>
                          <span className="font-semibold text-text-primary">580+ (cu13.3)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2 py-1.5">
                          <span className="text-text-tertiary">GPU</span>
                          <span className="font-semibold text-text-primary">RTX 5090</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2 py-1.5">
                          <span className="text-text-tertiary">VRAM</span>
                          <span className="font-semibold text-text-primary">32GB (16 min)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2 py-1.5">
                          <span className="text-text-tertiary">Docker</span>
                          <span className="font-semibold text-text-primary">24+ + nvidia-ctk</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2 py-1.5">
                          <span className="text-text-tertiary">Disk</span>
                          <span className="font-semibold text-text-primary">60GB+ free</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border-default bg-bg-secondary p-2 font-mono text-[10px] leading-3.5 text-text-secondary">
                        Ports: 47900 (vLLM) + 47901 (Agent). Tailscale container runs isolated (no conflict with personal host tailnet).
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Zero-Account Node Access Dashboard (Inspect node stats with pubkey) */}
            <NodeLoginDashboard />



            {/* ========================================================================= */}
            {/* SECTION 2: TECHNICAL SETUP, SECURITY ARCHITECTURE & INSTALLATION         */}
            {/* ========================================================================= */}

            {/* Technical Section Divider Banner */}
            <div className="relative pt-6 pb-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border-dim" />
              </div>
              <div className="relative flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent-brand/30 bg-bg-secondary px-4 py-1.5 font-mono text-xs font-bold text-accent-brand shadow-sm">
                  <Terminal className="h-4 w-4" /> Technical Setup & Node Onboarding Guide
                </span>
              </div>
            </div>

            {/* REQUIRED DEDICATED CARD: Zero-Account Key Architecture & Hardware Fingerprint Lock */}
            <Card className="border border-border-dim bg-bg-secondary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-text-primary">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4.5 w-4.5 text-accent-brand" /> Zero-Account Architecture: Key Pair & Hardware Lock
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                    Ed25519 + SHA-256 Hardware Fingerprint
                  </Badge>
                </CardTitle>
                <p className="font-mono text-xs text-text-tertiary leading-4">
                  Jak działa bezhasłowy system identyfikacji węzła SeedInfer bez rejestracji konta, podawania maila czy haseł:
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3.5 md:grid-cols-3">
                  
                  {/* Klucz Prywatny */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-accent-brand">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-brand/10 border border-accent-brand/20">
                        <Key className="h-4 w-4 text-accent-brand" />
                      </div>
                      1. Klucz Prywatny (Private Key)
                    </div>
                    <div className="font-mono text-[11px] text-text-tertiary">
                      Plik lokalny: <code className="rounded bg-bg-tertiary px-1 text-text-primary">/opt/seedinfer-provider/seedinfer.key</code>
                    </div>
                    <p className="font-mono text-xs leading-4 text-text-secondary">
                      Generowany automatycznie w algorytmie <strong className="text-text-primary">Ed25519</strong> przy pierwszym starcie kontenera. 
                      <span className="text-accent-red font-semibold"> Nigdy nie opuszcza Twojej maszyny</span> i nie jest przesyłany przez sieć. Służy do cyfrowego podpisywania heartbeatów oraz potwierdzania przetworzonych tokenów (Proof of Work).
                    </p>
                    <div className="rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary">
                      Perms: 600 (-rw-------) · Nie udostępniaj nikomu pliku seedinfer.key
                    </div>
                  </div>

                  {/* Klucz Publiczny */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-accent-green">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-green/10 border border-accent-green/20">
                        <Globe className="h-4 w-4 text-accent-green" />
                      </div>
                      2. Klucz Publiczny (Public Key)
                    </div>
                    <div className="font-mono text-[11px] text-text-tertiary">
                      Identyfikator: <code className="rounded bg-bg-tertiary px-1 text-text-primary">pubkey_ed25519_...</code>
                    </div>
                    <p className="font-mono text-xs leading-4 text-text-secondary">
                      Jawny identyfikator węzła zgłaszany do SeedInfer Gateway (<code className="rounded bg-bg-tertiary px-1 text-text-primary">/api/v1/providers</code>). 
                      Działa jako Twój anonimowy adres rozliczeniowy Zero-Account. Pozwala sprawdzać status węzła w panelu, mierzyć TTFT oraz automatycznie kierować wypłaty USDC na sieci Base bez podawania danych osobowych.
                    </p>
                    <div className="rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary">
                      Rejestracja: Auto-register w gateway przy pierwszym sygnale heartbeat
                    </div>
                  </div>

                  {/* Odcisk Sprzętowy */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-purple-400">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <Fingerprint className="h-4 w-4 text-purple-400" />
                      </div>
                      3. Odcisk Sprzętowy (Hardware Lock)
                    </div>
                    <div className="font-mono text-[11px] text-text-tertiary">
                      Sygnatura: <code className="rounded bg-bg-tertiary px-1 text-text-primary">SHA-256(GPU_UUID + PCIe_Bus + machine-id)</code>
                    </div>
                    <p className="font-mono text-xs leading-4 text-text-secondary">
                      Unikalna sygnatura sprzętowa wyliczana przez agenta na podstawie fizycznego układu GPU (<code className="rounded bg-bg-tertiary px-1 text-text-primary">nvidia-smi</code>) i identyfikatora płyty głównej. 
                      Trwale wiąże Twój klucz z fizycznym rigiem, uniemożliwiając klonowanie tożsamości węzła na innych maszynach. Niezgodność sprzętu natychmiast blokuje ruch (<code className="text-accent-red">HARDWARE MISMATCH</code>).
                    </p>
                    <div className="rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary">
                      Ochrona: Wykrywanie kopii VM / sklonowanych kluczy prywatnych
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* One-liner Installation & Authkey Invite Generator */}
            <Card id="install" className="border border-border-dim bg-bg-secondary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-accent-brand" /> One-liner Installation — Terminal Linux
                    <Badge variant="outline" className="font-mono text-[10px]">
                      curl | bash
                    </Badge>
                  </div>
                </CardTitle>
                <p className="font-mono text-xs text-text-tertiary">
                  Jeden polecenie w konsoli Linux (Ubuntu 24.04+): <code className="rounded bg-bg-tertiary px-1 text-text-primary">curl -fsSL https://seedinfer.com/install.sh | bash</code> — automatyczne pobranie authkey, weryfikacja nvidia-smi (porty 47900/47901), instalacja Docker + nvidia-ctk + kontenerowego Tailscale oraz uruchomienie silnika inference.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Authkey invite generator box */}
                <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-accent-brand" />
                      <span className="text-sm font-medium text-text-primary">Invite Authkey</span>
                      <span className="font-mono text-xs text-text-tertiary">tag:provider · 24h ważności</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateKey()}
                        disabled={authLoading}
                        className="gap-1.5 font-mono text-xs"
                      >
                        {authLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                        Generate invite key
                      </Button>
                    </div>
                  </div>

                  {authKey && (
                    <div className="mt-3 rounded-lg border border-accent-green/20 bg-accent-green/10 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs font-semibold text-accent-green">Authkey ready</div>
                          <div className="mt-1 break-all rounded bg-bg-secondary p-2 font-mono text-xs text-text-primary">
                            {authKey}
                          </div>
                          {authMeta && (
                            <div className="mt-1 font-mono text-[11px] text-text-tertiary">
                              {authMeta.expires} · {authMeta.login_server} · Key valid for 24h, one-time use
                            </div>
                          )}
                        </div>
                        <CopyButton text={authKey} label="Copy key" />
                      </div>
                    </div>
                  )}
                  {!authKey && (
                    <div className="mt-3 rounded-lg border border-dashed border-border-default bg-bg-secondary p-2.5 font-mono text-xs text-text-secondary">
                      Kliknij <strong className="text-text-primary">Generate invite key</strong> aby wygenerować klucz instalacyjny (24h ważności, jednorazowy). Skrypt <code className="rounded bg-bg-tertiary px-1 text-text-primary">install.sh</code> domyślnie pobierze klucz automatycznie jeśli uruchomiony bez parametrów.
                    </div>
                  )}
                  {error && <div className="mt-2 font-mono text-xs text-accent-red">{error}</div>}
                </div>

                {/* Main recommended installation command */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-accent-brand/30 bg-accent-brand/5 p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-accent-brand flex items-center gap-1 font-bold">
                        <Zap className="h-3.5 w-3.5" /> Polecane — jedna komenda (auto-authkey + prebuild)
                      </span>
                      <CopyButton text={ONE_LINER_RECOMMENDED} />
                    </div>
                    <pre className="overflow-x-auto rounded-xl border border-accent-brand/20 bg-bg-primary p-3 font-mono text-xs leading-4 text-text-primary">
                      {ONE_LINER_RECOMMENDED}
                    </pre>
                    <p className="mt-2 font-mono text-[11px] leading-4 text-text-secondary">
                      Bez dodatkowych parametrów — <code className="rounded bg-bg-tertiary px-1 text-text-primary">install.sh</code> automatycznie pobiera authkey z bramki{" "}
                      <code className="rounded bg-bg-tertiary px-1 text-text-primary">https://seedinfer.com/api/v1/auth/request</code> (tag:provider, 24h) i wykonuje szybki pull gotowej obrazu{" "}
                      <code className="rounded bg-bg-tertiary px-1 text-text-primary">docker pull ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> (fallback: docker load / build).
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
                      <span className="rounded bg-bg-tertiary px-2 py-0.5 text-text-tertiary">Gateway https://seedinfer.com</span>
                      <span className="rounded bg-bg-tertiary px-2 py-0.5 text-text-tertiary">Tailnet https://tailnet.seedinfer.com</span>
                      <span className="rounded bg-bg-tertiary px-2 py-0.5 text-text-tertiary">Prebuild ghcr.io → docker compose</span>
                    </div>
                  </div>

                  {/* Advanced Custom Installation Commands */}
                  <details className="rounded-xl border border-border-dim bg-bg-primary">
                    <summary className="cursor-pointer list-none px-4 py-3 font-mono text-xs font-semibold text-text-primary flex items-center justify-between hover:bg-bg-tertiary/40 transition-colors">
                      <span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-accent-brand" /> Zaawansowane — własny authkey / model / gateway / env</span>
                      <span className="font-mono text-[10px] text-text-tertiary border border-border-dim rounded px-2 py-0.5">Rozwiń</span>
                    </summary>
                    <div className="space-y-3 border-t border-border-dim p-3.5">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                            1 · Z ręcznym wygenerowanym kluczem (--authkey)
                          </span>
                          <CopyButton text={oneLinerWithKey} />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-secondary p-3 font-mono text-xs leading-4 text-text-primary">
                          {oneLinerWithKey}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                            2 · Pełna kastomizacja parametrów
                          </span>
                          <CopyButton text={ONE_LINER_CUSTOM} />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-secondary p-3 font-mono text-xs leading-4 text-text-secondary">
                          {ONE_LINER_CUSTOM}
                        </pre>
                        <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                          Override zmiennych ENV: <code className="rounded bg-bg-tertiary px-1 text-text-primary">SEEDINFER_PREBUILD_IMAGE=ghcr.io/...</code> · <code className="rounded bg-bg-tertiary px-1 text-text-primary">VLLM_PORT=47900</code> · <code className="rounded bg-bg-tertiary px-1 text-text-primary">AGENT_PORT=47901</code>
                        </p>
                      </div>
                    </div>
                  </details>
                </div>
              </CardContent>
            </Card>

            {/* Step-by-Step Onboarding Pipeline */}
            <Card className="border border-border-dim bg-bg-secondary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Clock className="h-4 w-4 text-accent-brand" /> Kroki Instalacji — Od komendy curl do aktywnego węzła w sieci
                  <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                    ~5 min + 30GB pobierania modelu
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  
                  {/* Step 1 */}
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white">
                        1
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">curl install.sh</div>
                      <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                        Weryfikuje układ GPU (<code className="rounded bg-bg-tertiary px-1 text-text-primary">nvidia-smi</code> min 32GB VRAM), sterownik 580+ (CUDA 13.3), wolne porty 47900/47901 oraz automatycznie instaluje Docker, <code className="rounded bg-bg-tertiary px-1 text-text-primary">nvidia-container-toolkit</code> i Tailscale.
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      nvidia-smi VRAM OK (&ge;32GB)
                      HF OK driver 580+ CUDA 13.3
                    </pre>
                  </li>

                  {/* Step 2 */}
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white">
                        2
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">Izolowany Tailscale</div>
                      <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                        <span className="inline-flex items-center rounded bg-accent-green/10 px-1.5 py-0.5 text-[10px] font-bold text-accent-green">Kontenerowy Mesh</span> — Jeśli Twój host używa prywatnego Tailscale (100.94.x.x), instalator tworzy niezależny kontener <code className="rounded bg-bg-tertiary px-1 text-text-primary">tailscale-seedinfer</code> (100.64.x.x). <strong>Nie rozłącza Twojej domowej sieci VPN!</strong>
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      Host: 100.94.x.x (Domowy Tailnet)
                      Kontener: 100.64.x.x (Headscale Mesh)
                    </pre>
                  </li>

                  {/* Step 3 */}
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white">
                        3
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">Docker Pull / Start Engine</div>
                      <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                        Pobiera gotowy kontener <code className="rounded bg-bg-tertiary px-1 text-text-primary">ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> i rozpoczyna pobieranie wag modelu (~30GB NVFP4) bezpośrednio do lokalnego cache <code className="rounded bg-bg-tertiary px-1 text-text-primary">./models/cache</code>.
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      docker compose up -d --build
                      vLLM model weight cache ~30GB
                    </pre>
                  </li>

                  {/* Step 4 */}
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-green text-xs font-bold text-white">
                        4
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">Health check & Fleet Join</div>
                      <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                        Agent przesyła heartbeat co 30s z podpisem cyfrowym Ed25519. Po 2 poprawnych heartbeatach bramka automatycznie zmienia status z <code className="text-amber-400">verifying</code> na <code className="text-accent-green">verified</code>.
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      Status: pending &rarr; verifying &rarr; VERIFIED
                      P2P routing aktywny (opacity 100)
                    </pre>
                  </li>

                </ol>
              </CardContent>
            </Card>

            {/* Download Assets & Console Verification Snippets */}
            <Card className="border border-border-dim bg-bg-secondary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Download className="h-4 w-4 text-accent-brand" /> Paczka Instalacyjna i Komendy Konsoli
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                <div className="grid gap-3 sm:grid-cols-3">
                  <a
                    href="/provider.tar.gz"
                    className="rounded-xl border border-accent-brand/20 bg-accent-brand/10 p-4 hover:bg-accent-brand/15 transition-colors"
                  >
                    <div className="flex items-center gap-2 font-semibold text-text-primary">
                      <Download className="h-4 w-4 text-accent-brand" /> provider.tar.gz
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">Pełny pakiet provider/ — Dockerfile.cuda + compose + agent</div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">Pobierz archiwa tar.gz &rarr;</div>
                  </a>

                  <a
                    href="/install.sh"
                    className="rounded-xl border border-border-dim bg-bg-primary p-4 hover:bg-bg-tertiary transition-colors"
                  >
                    <div className="flex items-center gap-2 font-semibold text-text-primary">
                      <FileText className="h-4 w-4 text-accent-brand" /> install.sh
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">Skrypt instalacyjny one-liner plug-and-play</div>
                    <div className="mt-2 font-mono text-[11px] text-text-tertiary">https://seedinfer.com/install.sh</div>
                  </a>

                  <a href="/docs" className="rounded-xl border border-border-dim bg-bg-primary p-4 hover:bg-bg-tertiary transition-colors">
                    <div className="flex items-center gap-2 font-semibold text-text-primary">
                      <Server className="h-4 w-4 text-accent-brand" /> Control Plane Docs
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">
                      Dokumentacja sieci Headscale (WireGuard) oraz parametrów ENV
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">Przejdź do /docs &rarr;</div>
                  </a>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  
                  {/* Verification local */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary font-bold mb-1.5">
                      Weryfikacja lokalna (Health check na maszynie)
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-2.5 font-mono text-[11px] text-text-secondary leading-4">
{`# 1. Sprawdź stan kontenerów:
docker ps | grep seedinfer-provider

# 2. Sprawdź health check agenta (port 47901):
curl -fsS http://127.0.0.1:47901/health | jq

# 3. Test odpowiedzi modelu vLLM (port 47900):
curl -fsS http://127.0.0.1:47900/v1/models | jq`}
                    </pre>
                  </div>

                  {/* Verification gateway */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary font-bold mb-1.5">
                      Weryfikacja w sieci Gateway (Remote verification)
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-2.5 font-mono text-[11px] text-text-secondary leading-4">
{`# Sprawdź widoczność swojego węzła w sieci:
curl -fsS https://seedinfer.com/api/v1/providers | jq '.data[] | {id,status,verification}'

# Statystyki aktywnej floty:
curl -fsS https://seedinfer.com/api/stats | jq '.active_providers'`}
                    </pre>
                  </div>

                </div>

              </CardContent>
            </Card>

            {/* Supported NVFP4 Models & GPU Compatibility Matrix */}
            <Card className="border border-border-dim bg-bg-secondary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-accent-brand" /> Supported Models & GPU Hardware Matrix (CUDA 13.3)
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                    Blackwell GB202 Native
                  </Badge>
                </CardTitle>
                <p className="font-mono text-xs text-text-tertiary">
                  Oficjalnie wspierany sprzęt flagowy: <strong className="text-text-primary">NVIDIA RTX 5090 32GB (GB202, sm_120, 24,576 CUDA, 32GB GDDR7 ~1.8 TB/s)</strong>. 
                  Sterownik 580+ oraz CUDA 13.3 zapewniają najwyższą wydajność dla modeli z kwantyzacją NVFP4.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Models Table */}
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2">Model ID</th>
                        <th className="px-3 py-2">HuggingFace Repo</th>
                        <th className="px-3 py-2">VRAM Load</th>
                        <th className="px-3 py-2">Pricing (In/Out)</th>
                        <th className="px-3 py-2">Disk Size</th>
                        <th className="px-3 py-2">Context</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr className="bg-accent-brand/10 font-medium text-text-primary">
                        <td className="px-3 py-2 font-bold text-accent-brand">google/gemma-4-26b-a4b-nvfp4</td>
                        <td className="px-3 py-2 text-xs">nvidia/Gemma-4-26B-A4B-NVFP4</td>
                        <td className="px-3 py-2">18-24GB</td>
                        <td className="px-3 py-2">$0.03 / $0.30</td>
                        <td className="px-3 py-2">~26GB</td>
                        <td className="px-3 py-2">262k</td>
                        <td className="px-3 py-2">
                          <Badge variant="success" className="text-[10px] font-mono">
                            flagship active
                          </Badge>
                        </td>
                      </tr>
                      <tr className="bg-accent-brand/5">
                        <td className="px-3 py-2 font-medium text-text-primary">seedinfer/nemotron-lightning-1m</td>
                        <td className="px-3 py-2 text-xs">nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4</td>
                        <td className="px-3 py-2">16-22GB</td>
                        <td className="px-3 py-2">$0.02 / $0.10</td>
                        <td className="px-3 py-2">~28GB</td>
                        <td className="px-3 py-2">1M (2M KV)</td>
                        <td className="px-3 py-2">
                          <Badge variant="success" className="text-[10px] font-mono">
                            active
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* GPU Matrix Table */}
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2">GPU Model</th>
                        <th className="px-3 py-2">Arch</th>
                        <th className="px-3 py-2">VRAM</th>
                        <th className="px-3 py-2">Bandwidth</th>
                        <th className="px-3 py-2">NVFP4 1M Ctx</th>
                        <th className="px-3 py-2">Est. Throughput</th>
                        <th className="px-3 py-2">Status Tier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      <tr className="bg-accent-brand/10 font-medium text-text-primary">
                        <td className="px-3 py-2 font-bold">RTX 5090 32GB</td>
                        <td className="px-3 py-2">GB202 sm_120</td>
                        <td className="px-3 py-2">32GB GDDR7</td>
                        <td className="px-3 py-2">~1.8 TB/s</td>
                        <td className="px-3 py-2">&check; ~22-28GB</td>
                        <td className="px-3 py-2">~120-180 tok/s</td>
                        <td className="px-3 py-2"><Badge variant="success" className="text-[10px]">Official Min</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">A100 40GB / 80GB</td>
                        <td className="px-3 py-2">GA100 sm_80</td>
                        <td className="px-3 py-2">40/80GB HBM2e</td>
                        <td className="px-3 py-2">1.6 - 2.0 TB/s</td>
                        <td className="px-3 py-2">&check; W4A16</td>
                        <td className="px-3 py-2">~70-100 tok/s</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Enterprise</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">H100 80GB</td>
                        <td className="px-3 py-2">H100 sm_90</td>
                        <td className="px-3 py-2">80GB HBM3</td>
                        <td className="px-3 py-2">3.0 TB/s</td>
                        <td className="px-3 py-2">&check; Native</td>
                        <td className="px-3 py-2">~150-220 tok/s</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Enterprise</Badge></td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">L40S / RTX 6000 Ada 48GB</td>
                        <td className="px-3 py-2">AD102 sm_89</td>
                        <td className="px-3 py-2">48GB GDDR6</td>
                        <td className="px-3 py-2">864 - 960 GB/s</td>
                        <td className="px-3 py-2">&check; Full Ctx</td>
                        <td className="px-3 py-2">~80-120 tok/s</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Supported</Badge></td>
                      </tr>
                      <tr className="opacity-60">
                        <td className="px-3 py-2">RTX 3090 / 4090 (24GB) ⏳</td>
                        <td className="px-3 py-2">GA102 / AD102</td>
                        <td className="px-3 py-2">24GB GDDR6X</td>
                        <td className="px-3 py-2">0.9 - 1.0 TB/s</td>
                        <td className="px-3 py-2">&warning; Ctx limit 131k</td>
                        <td className="px-3 py-2">~50-80 tok/s</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Roadmap</Badge></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </CardContent>
            </Card>

            {/* Footer */}
            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary flex flex-wrap items-center justify-between gap-2">
              <div>
                SeedInfer.com · Node Provider Portal Faza 0 (CUDA 13.3)
              </div>
              <div className="flex items-center gap-3">
                <a href="/install.sh" className="text-accent-brand hover:underline">/install.sh</a>
                <span>·</span>
                <a href="/provider.tar.gz" className="text-accent-brand hover:underline">/provider.tar.gz</a>
                <span>·</span>
                <a href="/api/v1/auth/request" className="text-accent-brand hover:underline">/api/v1/auth/request</a>
                <span>·</span>
                <a href="/api/v1/providers" className="text-accent-brand hover:underline">/api/v1/providers</a>
                <span>·</span>
                <a href="/docs" className="text-accent-brand underline">docs.seedinfer.com</a>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}

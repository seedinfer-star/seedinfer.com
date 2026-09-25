"use client"

import { useState } from "react"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer } from "@/components/app-shell"
import ProviderContactForm from "@/components/provider-contact-form"
import Calculator from "@/components/calculator"
import {
  MODELS,
  LIVE_MODEL,
  GPU_SPECS,
  REFERENCE_GPU,
  MIN_VRAM_GB,
  PROVIDER_ECONOMICS,
  REVENUE_SHARE_PCT,
  PROTOCOL_FEE_PCT,
  STANDBY_LABEL,
  PAYOUT_LABEL,
  usd,
} from "@/lib/catalog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

const ONE_LINER_RECOMMENDED = `curl -fsSL https://seedinfer.com/install.sh | SEEDINFER_NODE_TOKEN=sipn_YOUR_TOKEN bash`
const ONE_LINER_SIMPLE = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --token sipn_YOUR_TOKEN`
const ONE_LINER_CUSTOM = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --token sipn_YOUR_TOKEN --model ${LIVE_MODEL.id} --gateway https://seedinfer.com --hostname my-gpu-node`

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

export default function ProviderContent() {
  return (
    <AppShell>
      <PageHeader
        title="Become a Provider"
        description={<>Earn {REVENUE_SHARE_PCT}% of token revenue · NVIDIA ≥{MIN_VRAM_GB}GB VRAM · {LIVE_MODEL.name}</>}
        actions={
          <>
            <Link
              href="/provider/portal"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5 text-accent-brand" /> Provider Portal
            </Link>
            <Link
              href="/earn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover transition-colors"
            >
              <Coins className="h-3.5 w-3.5" /> Earnings
            </Link>
          </>
        }
      />
      <PageContainer className="space-y-5">

            {/* Hero Card */}
            <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary shadow-md">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="success" className="gap-1 font-mono text-[10px]">
                        <BadgeCheck className="h-3 w-3" /> Live model: {LIVE_MODEL.name}
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
                        {REVENUE_SHARE_PCT}% revenue share · monthly USDC on Base
                      </Badge>
                    </div>

                    <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                      Become a node operator
                    </h2>
                    
                    <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-5 text-text-secondary">
                      Serve <code className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-xs text-text-primary">{LIVE_MODEL.id}</code> on an NVIDIA GPU with at least {MIN_VRAM_GB}GB VRAM (reference node: {REFERENCE_GPU.name}).
                      No account registration needed — the agent generates an Ed25519 key and a hardware-bound identity on first start.
                      You receive <strong className="text-text-primary">{REVENUE_SHARE_PCT}% of the token revenue</strong> your node serves ({PROTOCOL_FEE_PCT}% protocol fee) plus a <strong className="text-text-primary">standby retainer of {STANDBY_LABEL}</strong>. Payouts: {PAYOUT_LABEL}.
                    </p>

                    <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Clock className="h-3 w-3 text-accent-brand" /> Standby retainer
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">${PROVIDER_ECONOMICS.standbyPerDayUsd.toFixed(2)} / day per node</div>
                        <div className="font-mono text-[10px] text-text-tertiary">paid for each day the node has &ge;{Math.round(PROVIDER_ECONOMICS.standbyMinUptime * 100)}% uptime</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Coins className="h-3 w-3 text-accent-green" /> Revenue share
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">{REVENUE_SHARE_PCT}% of token revenue</div>
                        <div className="font-mono text-[10px] text-text-tertiary">{PROTOCOL_FEE_PCT}% protocol fee · min payout ${PROVIDER_ECONOMICS.minPayoutUsd.toFixed(2)}</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-tertiary/60 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary flex items-center gap-1">
                          <Cpu className="h-3 w-3 text-accent-brand" /> Context & Hardware
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-text-primary">{LIVE_MODEL.contextLabel} · ≥{MIN_VRAM_GB}GB VRAM</div>
                        <div className="font-mono text-[10px] text-text-tertiary">NVFP4 weights + FP8 KV cache · 24GB cards not supported yet</div>
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
                          <span className="font-semibold text-text-primary">NVIDIA</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2 py-1.5">
                          <span className="text-text-tertiary">VRAM</span>
                          <span className="font-semibold text-text-primary">{MIN_VRAM_GB}GB min</span>
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
                        Ports: 47900 (vLLM) + 47901 (agent). The mesh VPN runs in its own container and does not interfere with an existing VPN on the host.
                      </div>
                      <a
                        href="#custom-application-form"
                        className="block rounded-lg border border-accent-brand/30 bg-accent-brand/10 p-2 text-center font-mono text-[11px] font-medium text-accent-brand transition-colors hover:bg-accent-brand/20"
                      >
                        Other NVIDIA hardware? Apply for custom onboarding &rarr;
                      </a>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Provider revenue & net-profit calculator */}
            <Calculator />

            {/* Custom hardware application */}
            <section id="custom-application-form" className="scroll-mt-4">
              <ProviderContactForm />
            </section>

            {/* Your nodes (signed in) */}
            <Card className="border border-accent-brand/20 bg-gradient-to-r from-accent-brand/10 via-bg-secondary to-bg-secondary">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-2.5">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                  <p className="min-w-0 font-mono text-xs leading-5 text-text-secondary">
                    <strong className="text-text-primary">Create a node token in the Provider portal (sign-in required)</strong>
                    <span className="block text-text-tertiary">Then run the installer below with your token.</span>
                  </p>
                </div>
                <Link
                  href="/provider/portal"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-brand-hover"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Open portal
                </Link>
              </CardContent>
            </Card>



            {/* ------------------------------------------------------------------------- */}
            {/* SECTION 2: TECHNICAL SETUP, SECURITY ARCHITECTURE & INSTALLATION         */}
            {/* ------------------------------------------------------------------------- */}

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
                  How SeedInfer identifies your node without an account, email or password:
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3.5 md:grid-cols-3">
                  
                  {/* Private key */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-accent-brand">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-brand/10 border border-accent-brand/20">
                        <Key className="h-4 w-4 text-accent-brand" />
                      </div>
                      1. Private key
                    </div>
                    <div className="font-mono text-[11px] text-text-tertiary">
                      Local file: <code className="rounded bg-bg-tertiary px-1 text-text-primary">/opt/seedinfer-provider/seedinfer.key</code>
                    </div>
                    <p className="font-mono text-xs leading-4 text-text-secondary">
                      Generated automatically (<strong className="text-text-primary">Ed25519</strong>) on the first container start.
                      <span className="text-accent-red font-semibold"> It never leaves your machine</span> and is never sent over the network. It signs heartbeats and served-token reports.
                    </p>
                    <div className="rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary">
                      Perms: 600 (-rw-------) · Never share seedinfer.key
                    </div>
                  </div>

                  {/* Public key */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-accent-green">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-green/10 border border-accent-green/20">
                        <Globe className="h-4 w-4 text-accent-green" />
                      </div>
                      2. Public key
                    </div>
                    <div className="font-mono text-[11px] text-text-tertiary">
                      Identifier: <code className="rounded bg-bg-tertiary px-1 text-text-primary">pubkey_ed25519_...</code>
                    </div>
                    <p className="font-mono text-xs leading-4 text-text-secondary">
                      Public node identifier reported to the SeedInfer gateway (<code className="rounded bg-bg-tertiary px-1 text-text-primary">/api/v1/providers</code>).
                      It acts as your anonymous settlement identity: use it to check node status and TTFT in the dashboard. Payouts go to your {PROVIDER_ECONOMICS.payoutAsset} address on {PROVIDER_ECONOMICS.payoutChain}.
                    </p>
                    <div className="rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary">
                      Registration: automatic on the first heartbeat
                    </div>
                  </div>

                  {/* Hardware fingerprint */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-purple-400">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <Fingerprint className="h-4 w-4 text-purple-400" />
                      </div>
                      3. Hardware fingerprint
                    </div>
                    <div className="font-mono text-[11px] text-text-tertiary">
                      Signature: <code className="rounded bg-bg-tertiary px-1 text-text-primary">SHA-256(GPU_UUID + PCIe_Bus + machine-id)</code>
                    </div>
                    <p className="font-mono text-xs leading-4 text-text-secondary">
                      A hardware signature computed by the agent from the physical GPU (<code className="rounded bg-bg-tertiary px-1 text-text-primary">nvidia-smi</code>) and the machine id.
                      It binds your key to the physical machine so the node identity cannot be cloned. A mismatch pauses traffic immediately (<code className="text-accent-red">HARDWARE MISMATCH</code>).
                    </p>
                    <div className="rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary">
                      Protection: detects cloned VMs / copied private keys
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
                    <Terminal className="h-4 w-4 text-accent-brand" /> One-line installation (Linux)
                    <Badge variant="outline" className="font-mono text-[10px]">
                      curl | bash
                    </Badge>
                  </div>
                </CardTitle>
                <p className="font-mono text-xs text-text-tertiary">
                  One command on Linux (Ubuntu 24.04+): create a node token in the{" "}
                  <Link href="/provider/portal" className="text-accent-brand underline">Provider portal (sign-in required)</Link>,
                  then run the command with your token — it checks the GPU with nvidia-smi and ports 47900/47901, installs Docker + NVIDIA Container Toolkit + the mesh VPN container and starts the inference engine.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Node token step */}
                <div className="rounded-xl border border-accent-brand/30 bg-accent-brand/5 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-accent-brand" />
                    <span className="text-sm font-medium text-text-primary">Node token</span>
                  </div>
                  <p className="mt-1 font-mono text-xs leading-5 text-text-secondary">
                    Create a node token in the{" "}
                    <Link href="/provider/portal" className="text-accent-brand underline">Provider portal (sign-in required)</Link>{" "}
                    and pass it as <code className="rounded bg-bg-tertiary px-1 text-text-primary">SEEDINFER_NODE_TOKEN=sipn_…</code> or{" "}
                    <code className="rounded bg-bg-tertiary px-1 text-text-primary">--token sipn_…</code>.
                  </p>
                </div>

                {/* Main recommended installation command */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-accent-brand/30 bg-accent-brand/5 p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-accent-brand flex items-center gap-1 font-bold">
                        <Zap className="h-3.5 w-3.5" /> Recommended — one command (with your node token)
                      </span>
                      <CopyButton text={ONE_LINER_RECOMMENDED} />
                    </div>
                    <pre className="overflow-x-auto rounded-xl border border-accent-brand/20 bg-bg-primary p-3 font-mono text-xs leading-4 text-text-primary">
                      {ONE_LINER_RECOMMENDED}
                    </pre>
                    <p className="mt-2 font-mono text-[11px] leading-4 text-text-secondary">
                      Create a node token in the{" "}
                      <Link href="/provider/portal" className="text-accent-brand underline">Provider portal (sign-in required)</Link>{" "}
                      and pass it to install.sh. The installer pulls the prebuilt image{" "}
                      <code className="rounded bg-bg-tertiary px-1 text-text-primary">ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> (falls back to a local build).
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
                      <span className="rounded bg-bg-tertiary px-2 py-0.5 text-text-tertiary">Gateway https://seedinfer.com</span>
                      <span className="rounded bg-bg-tertiary px-2 py-0.5 text-text-tertiary">Prebuilt image → docker compose</span>
                    </div>
                  </div>

                  {/* Advanced Custom Installation Commands */}
                  <details className="rounded-xl border border-border-dim bg-bg-primary">
                    <summary className="cursor-pointer list-none px-4 py-3 font-mono text-xs font-semibold text-text-primary flex items-center justify-between hover:bg-bg-tertiary/40 transition-colors">
                      <span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-accent-brand" /> Advanced — custom key / model / gateway / env</span>
                      <span className="font-mono text-[10px] text-text-tertiary border border-border-dim rounded px-2 py-0.5">Expand</span>
                    </summary>
                    <div className="space-y-3 border-t border-border-dim p-3.5">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                            1 · With your node token (--token)
                          </span>
                          <CopyButton text={ONE_LINER_SIMPLE} />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-secondary p-3 font-mono text-xs leading-4 text-text-primary">
                          {ONE_LINER_SIMPLE}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                            2 · All parameters
                          </span>
                          <CopyButton text={ONE_LINER_CUSTOM} />
                        </div>
                        <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-secondary p-3 font-mono text-xs leading-4 text-text-secondary">
                          {ONE_LINER_CUSTOM}
                        </pre>
                        <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                          Environment overrides: <code className="rounded bg-bg-tertiary px-1 text-text-primary">SEEDINFER_PREBUILD_IMAGE=ghcr.io/...</code> · <code className="rounded bg-bg-tertiary px-1 text-text-primary">VLLM_PORT=47900</code> · <code className="rounded bg-bg-tertiary px-1 text-text-primary">AGENT_PORT=47901</code>
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
                  <Clock className="h-4 w-4 text-accent-brand" /> Installation steps — from curl to a live node
                  <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                    ~5 min + model download
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
                        Checks the GPU (<code className="rounded bg-bg-tertiary px-1 text-text-primary">nvidia-smi</code>, min {MIN_VRAM_GB}GB VRAM), driver 580+ (CUDA 13.3) and free ports 47900/47901, then installs Docker, <code className="rounded bg-bg-tertiary px-1 text-text-primary">nvidia-container-toolkit</code> and the mesh VPN.
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      nvidia-smi VRAM OK (&ge;{MIN_VRAM_GB}GB)
                      driver 580+ · CUDA 13.3 OK
                    </pre>
                  </li>

                  {/* Step 2 */}
                  <li className="rounded-xl border border-border-dim bg-bg-primary p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white">
                        2
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">Isolated mesh VPN</div>
                      <div className="mt-1 font-mono text-xs leading-4 text-text-secondary">
                        <span className="inline-flex items-center rounded bg-accent-green/10 px-1.5 py-0.5 text-[10px] font-bold text-accent-green">Containerized</span> — the installer runs the SeedInfer mesh in its own container (<code className="rounded bg-bg-tertiary px-1 text-text-primary">tailscale-seedinfer</code>). <strong>Your existing VPN stays connected.</strong>
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      Host VPN: unchanged
                      Container: SeedInfer mesh
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
                        Pulls <code className="rounded bg-bg-tertiary px-1 text-text-primary">ghcr.io/seedinfer/provider:cuda13.3-nvfp4</code> and downloads the {LIVE_MODEL.name} weights into the local model cache.
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      docker compose up -d --build
                      model weights → local cache
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
                        The agent sends a signed Ed25519 heartbeat every {PROVIDER_ECONOMICS.heartbeatIntervalSec}s. After 2 valid heartbeats the gateway verifies the node and moves it from <code className="text-amber-400">verifying</code> to <code className="text-accent-green">verified</code>. Nodes silent for 5 minutes are shown as offline.
                      </div>
                    </div>
                    <pre className="mt-3 rounded-lg bg-bg-tertiary p-2 font-mono text-[10px] text-text-tertiary leading-3">
                      Status: pending &rarr; verifying &rarr; VERIFIED
                      Routing active
                    </pre>
                  </li>

                </ol>
              </CardContent>
            </Card>

            {/* Download Assets & Console Verification Snippets */}
            <Card className="border border-border-dim bg-bg-secondary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <Download className="h-4 w-4 text-accent-brand" /> Install package & console commands
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
                    <div className="mt-1 font-mono text-xs text-text-secondary">Full provider/ package — Dockerfile.cuda + compose + agent</div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">Download tar.gz &rarr;</div>
                  </a>

                  <a
                    href="/install.sh"
                    className="rounded-xl border border-border-dim bg-bg-primary p-4 hover:bg-bg-tertiary transition-colors"
                  >
                    <div className="flex items-center gap-2 font-semibold text-text-primary">
                      <FileText className="h-4 w-4 text-accent-brand" /> install.sh
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">One-line install script</div>
                    <div className="mt-2 font-mono text-[11px] text-text-tertiary">https://seedinfer.com/install.sh</div>
                  </a>

                  <a href="/docs" className="rounded-xl border border-border-dim bg-bg-primary p-4 hover:bg-bg-tertiary transition-colors">
                    <div className="flex items-center gap-2 font-semibold text-text-primary">
                      <Server className="h-4 w-4 text-accent-brand" /> Provider docs
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-secondary">
                      Mesh networking and environment variables
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-accent-brand">Open /docs &rarr;</div>
                  </a>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  
                  {/* Verification local */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary font-bold mb-1.5">
                      Local check (on your machine)
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-2.5 font-mono text-[11px] text-text-secondary leading-4">
{`# 1. Container status:
docker ps | grep seedinfer-provider

# 2. Agent health (port 47901):
curl -fsS http://127.0.0.1:47901/health | jq

# 3. vLLM model list (port 47900):
curl -fsS http://127.0.0.1:47900/v1/models | jq`}
                    </pre>
                  </div>

                  {/* Verification gateway */}
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary font-bold mb-1.5">
                      Gateway check (remote)
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-2.5 font-mono text-[11px] text-text-secondary leading-4">
{`# Is your node visible?
curl -fsS https://seedinfer.com/api/v1/providers | jq '.data[] | {id,status,verification}'

# Active nodes:
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
                    <Cpu className="h-4 w-4 text-accent-brand" /> Supported models & GPUs (CUDA 13.3)
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                    Reference: {REFERENCE_GPU.name}
                  </Badge>
                </CardTitle>
                <p className="font-mono text-xs text-text-tertiary">
                  Reference node: <strong className="text-text-primary">NVIDIA {REFERENCE_GPU.name} ({REFERENCE_GPU.cudaCores?.toLocaleString("en-US")} CUDA cores, {REFERENCE_GPU.memBandwidthGBs?.toLocaleString("en-US")} GB/s, {REFERENCE_GPU.tdpW} W TDP)</strong>.
                  Driver 580+ and CUDA 13.3 are required for NVFP4 models. Minimum {MIN_VRAM_GB}GB VRAM.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Models Table */}
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2">Model ID</th>
                        <th className="px-3 py-2">Hugging Face repo</th>
                        <th className="px-3 py-2">Price in / out (1M)</th>
                        <th className="px-3 py-2">Context</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      {MODELS.map((m) => (
                        <tr key={m.id} className={m.status === "live" ? "bg-accent-brand/10 font-medium text-text-primary" : ""}>
                          <td className={`px-3 py-2 ${m.status === "live" ? "font-bold text-accent-brand" : "font-medium text-text-primary"}`}>{m.id}</td>
                          <td className="px-3 py-2 text-xs">{m.hfId || "—"}</td>
                          <td className="px-3 py-2">{usd(m.pricePer1M.input)} / {usd(m.pricePer1M.output)}</td>
                          <td className="px-3 py-2">{m.contextLabel}</td>
                          <td className="px-3 py-2">
                            {m.status === "live" ? (
                              <Badge variant="success" className="text-[10px] font-mono">live</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-mono">coming soon</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* GPU Matrix Table */}
                <div className="overflow-x-auto rounded-xl border border-border-dim">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2">GPU</th>
                        <th className="px-3 py-2">VRAM</th>
                        <th className="px-3 py-2">TDP</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim text-text-secondary">
                      {GPU_SPECS.map((g) => (
                        <tr key={g.key} className={g.key === REFERENCE_GPU.key ? "bg-accent-brand/10 font-medium text-text-primary" : g.supported ? "" : "opacity-60"}>
                          <td className="px-3 py-2 font-bold">{g.name}</td>
                          <td className="px-3 py-2">{g.vramGb}GB</td>
                          <td className="px-3 py-2">{g.tdpW} W</td>
                          <td className="px-3 py-2">
                            {g.supported ? (
                              <Badge variant={g.key === REFERENCE_GPU.key ? "success" : "outline"} className="text-[10px]">
                                {g.note || "Supported"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">{g.note || "Roadmap"}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </CardContent>
            </Card>

            {/* Footer */}
            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary flex flex-wrap items-center justify-between gap-2">
              <div>
                SeedInfer.com · Provider portal · Phase 0
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <a href="/install.sh" className="text-accent-brand hover:underline">/install.sh</a>
                <span>·</span>
                <a href="/provider.tar.gz" className="text-accent-brand hover:underline">/provider.tar.gz</a>
                <span>·</span>
                <a href="/provider/portal" className="text-accent-brand hover:underline">/provider/portal</a>
                <span>·</span>
                <a href="/api/v1/providers" className="text-accent-brand hover:underline">/api/v1/providers</a>
                <span>·</span>
                <a href="/docs" className="text-accent-brand underline">/docs</a>
              </div>
            </div>

      </PageContainer>
    </AppShell>
  )
}

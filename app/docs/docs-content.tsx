"use client"

import { useState } from "react"
import Link from "next/link"
import Sidebar from "@/components/sidebar"
import ProviderContactForm from "@/components/provider-contact-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Copy,
  Check,
  Server,
  Terminal,
  Cpu,
  HardDrive,
  Zap,
  FileText,
  ShieldCheck,
  Activity,
  Download,
  KeyRound,
  ExternalLink,
  Clock,
  Globe,
  Wrench,
  Code2,
  Lock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Coins,
  ArrowRight
} from "lucide-react"

const ONE_LINER_RECOMMENDED = `curl -fsSL https://seedinfer.com/install.sh | bash`
const ONE_LINER_SIMPLE = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey YOUR_AUTHKEY`
const ONE_LINER_AUTO = `curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey $(curl -s https://seedinfer.com/api/v1/auth/request | jq -r .authkey)`

const PYTHON_EXAMPLE = `import openai

client = openai.OpenAI(
    base_url="https://seedinfer.com/v1",
    api_key="sk-seedinfer-demo" # or your dedicated API key
)

response = client.chat.completions.create(
    model="google/gemma-4-26b-a4b-nvfp4",
    messages=[
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": "Explain quantum computing in 2 sentences."}
    ],
    temperature=0.7,
    max_tokens=150
)

print(response.choices[0].message.content)`

const CURL_EXAMPLE = `curl -X POST https://seedinfer.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-seedinfer-demo" \\
  -d '{
    "model": "google/gemma-4-26b-a4b-nvfp4",
    "messages": [{"role": "user", "content": "Hello SeedInfer!"}],
    "stream": false
  }'`

const JS_EXAMPLE = `import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://seedinfer.com/v1',
  apiKey: 'sk-seedinfer-demo',
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Hello SeedInfer!' }],
    model: 'google/gemma-4-26b-a4b-nvfp4',
  });

  console.log(completion.choices[0].message.content);
}
main();`

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
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1 font-mono text-[11px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label || "Copy"}
    </button>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-primary p-3.5 font-mono text-xs leading-5 text-text-secondary whitespace-pre-wrap break-all shadow-inner">
        {code}
      </pre>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border-dim bg-bg-primary overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left font-medium text-text-primary hover:bg-bg-tertiary/50 transition-colors"
      >
        <span className="text-sm font-semibold flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-accent-brand shrink-0" />
          {question}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 text-text-tertiary" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border-dim/50 text-xs leading-5 text-text-secondary font-sans">
          {answer}
        </div>
      )}
    </div>
  )
}

export default function DocsContent() {
  const [tab, setTab] = useState<"provider" | "client">("client")

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0 flex items-center gap-3">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">
              SeedInfer Documentation Center
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px] border-accent-brand/30 text-accent-brand">
              v1.0 Decentralized Network
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/provider"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-brand-hover transition-colors shadow-sm"
            >
              <Server className="h-3.5 w-3.5" /> Become a Provider
            </Link>
            <Link
              href="/earn"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <Coins className="h-3.5 w-3.5 text-accent-green" /> Calculator & Earnings
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">

            {/* Top Centered Section Header */}
            <div className="text-center max-w-2xl mx-auto space-y-2 pt-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider text-accent-brand border-accent-brand/30 bg-accent-brand/10">
                Select Documentation Section
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                SeedInfer Technical Documentation
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-5">
                Comprehensive guides for hardware node operators (Providers) and software developers integrating the API (Clients).
              </p>
            </div>

            {/* TWO LARGE CENTERED SELECTION BUTTONS / CARDS */}
            <div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto">
              {/* Provider Card Button */}
              <button
                onClick={() => setTab("provider")}
                className={`relative flex flex-col items-start p-5 rounded-2xl border text-left transition-all duration-200 shadow-md ${
                  tab === "provider"
                    ? "border-accent-brand bg-gradient-to-br from-accent-brand/15 via-bg-secondary to-bg-secondary ring-2 ring-accent-brand/40"
                    : "border-border-dim bg-bg-secondary hover:border-border-default hover:bg-bg-tertiary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                    tab === "provider"
                      ? "bg-accent-brand text-white border-accent-brand"
                      : "bg-bg-tertiary text-text-secondary border-border-default"
                  }`}>
                    <Server className="h-5 w-5" />
                  </div>
                  <Badge
                    variant={tab === "provider" ? "success" : "outline"}
                    className="font-mono text-[10px]"
                  >
                    {tab === "provider" ? "Active Section" : "Nodes & Hardware"}
                  </Badge>
                </div>

                <h3 className="mt-4 text-base font-bold text-text-primary flex items-center gap-2">
                  Provider Documentation
                  <ArrowRight className={`h-4 w-4 transition-transform ${tab === "provider" ? "translate-x-1 text-accent-brand" : "text-text-tertiary"}`} />
                </h3>
                <p className="mt-1 font-mono text-xs text-text-secondary leading-5">
                  For Hardware Providers and Node Operators. Setup instructions for <code className="rounded bg-bg-tertiary px-1">install.sh</code>, RTX 5090 32GB baseline requirements, Ed25519 authorization keypair, hardware fingerprinting, and provider FAQ.
                </p>
              </button>

              {/* Client Card Button */}
              <button
                onClick={() => setTab("client")}
                className={`relative flex flex-col items-start p-5 rounded-2xl border text-left transition-all duration-200 shadow-md ${
                  tab === "client"
                    ? "border-accent-brand bg-gradient-to-br from-accent-brand/15 via-bg-secondary to-bg-secondary ring-2 ring-accent-brand/40"
                    : "border-border-dim bg-bg-secondary hover:border-border-default hover:bg-bg-tertiary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                    tab === "client"
                      ? "bg-accent-brand text-white border-accent-brand"
                      : "bg-bg-tertiary text-text-secondary border-border-default"
                  }`}>
                    <Code2 className="h-5 w-5" />
                  </div>
                  <Badge
                    variant={tab === "client" ? "success" : "outline"}
                    className="font-mono text-[10px]"
                  >
                    {tab === "client" ? "Active Section" : "API & Integration"}
                  </Badge>
                </div>

                <h3 className="mt-4 text-base font-bold text-text-primary flex items-center gap-2">
                  Client Documentation
                  <ArrowRight className={`h-4 w-4 transition-transform ${tab === "client" ? "translate-x-1 text-accent-brand" : "text-text-tertiary"}`} />
                </h3>
                <p className="mt-1 font-mono text-xs text-text-secondary leading-5">
                  For Developers and API Consumers. OpenAI SDK integration, code examples in Python, cURL, and JS, endpoint specification for <code className="rounded bg-bg-tertiary px-1">/v1/chat/completions</code>, pricing schedules, and client FAQ.
                </p>
              </button>
            </div>

            <div className="border-t border-border-dim/60 pt-4" />

            {/* ========================================================================= */}
            {/* TAB 1: PROVIDER DOCUMENTATION                                             */}
            {/* ========================================================================= */}
            {tab === "provider" && (
              <div className="space-y-6">
                {/* Provider Hero Card */}
                <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="success" className="gap-1">
                            <ShieldCheck className="h-3 w-3" /> Zero-Account Architecture
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Ed25519 Keypair Auth
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Hardware Fingerprint Lock
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                            CUDA 13.3 · Blackwell GB202
                          </Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-primary">
                          Provider Node Setup & Hardware Guide
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                          Host AI models on decentralized P2P inference infrastructure. No email registration required. Your identity is cryptographically bound to your <strong className="text-text-primary">Ed25519 Keypair</strong> and hardware locked via <strong className="text-text-primary">SHA-256 System Fingerprint</strong>.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href="#prov-hardware" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            Hardware Specs ↓
                          </a>
                          <a href="#prov-install" className="inline-flex items-center gap-1 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover">
                            <Terminal className="h-3.5 w-3.5" /> Quick Install ↓
                          </a>
                          <a href="#prov-faq" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            <HelpCircle className="h-3.5 w-3.5 text-accent-brand" /> Provider FAQ ↓
                          </a>
                        </div>
                      </div>

                      <Card className="w-full shrink-0 border border-border-dim bg-bg-primary/60 lg:w-[380px]">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                            <ShieldCheck className="h-3.5 w-3.5 text-accent-brand" /> Minimum Node Requirements
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-0 font-mono text-xs">
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
                          <div className="rounded-lg border border-dashed border-border-default bg-bg-primary p-2 font-mono text-[10px] leading-3.5 text-text-secondary">
                            Ports: 47900 (vLLM) + 47901 (Agent). Tailscale container runs isolated (no conflict with personal host tailnet). Autostart via Plug & Play systemd.
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="mt-4">
                      <ProviderContactForm />
                    </div>
                  </CardContent>
                </Card>

                {/* Zero-Account Security Details */}
                <Card className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Lock className="h-4 w-4 text-accent-brand" /> Zero-Account Security Architecture (Ed25519 & Fingerprinting)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                          <KeyRound className="h-4 w-4 text-accent-brand" /> 1. Ed25519 Cryptographic Keys
                        </div>
                        <p className="font-mono text-xs leading-5 text-text-secondary">
                          On initial launch, the installation script generates an Ed25519 keypair in <code className="rounded bg-bg-tertiary px-1">/etc/seedinfer/identity.key</code>:
                        </p>
                        <ul className="list-disc pl-5 font-mono text-[11px] leading-4 text-text-tertiary space-y-1">
                          <li><strong>Private Key:</strong> Stored locally with 0600 permissions. Never leaves your server. Used to sign node heartbeats.</li>
                          <li><strong>Public Key:</strong> Your sole network identifier (Zero-Account ID). Monthly USDC payouts on Base are routed to this address.</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                          <ShieldCheck className="h-4 w-4 text-accent-green" /> 2. Hardware Fingerprint Lock
                        </div>
                        <p className="font-mono text-xs leading-5 text-text-secondary">
                          The agent constructs a unique digital hardware fingerprint based on GPU UUID, motherboard serial, and CPU ID:
                        </p>
                        <ul className="list-disc pl-5 font-mono text-[11px] leading-4 text-text-tertiary space-y-1">
                          <li>The SHA-256 fingerprint is cryptographically linked to your public key during initial registration.</li>
                          <li>This prevents container cloning or executing unauthorized virtual node copies on different hardware.</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* VRAM Math & Hardware Specs */}
                <Card id="prov-hardware" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <HardDrive className="h-4 w-4 text-accent-brand" /> VRAM Requirement & GPU Matrix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">NVFP4 Model Weights</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-text-primary">16 - 22 GB</div>
                        <div className="mt-1 font-mono text-xs text-text-secondary">W4A16 + FP8 via ModelOpt. ~20-30GB downloaded from HuggingFace cache.</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">KV Cache (1M Context)</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-text-primary">~6 - 10 GB</div>
                        <div className="mt-1 font-mono text-xs text-text-secondary">FP8 KV cache with <code className="rounded bg-bg-tertiary px-1">--kv-cache-dtype fp8</code> flags.</div>
                      </div>
                      <div className="rounded-xl border border-accent-brand/20 bg-accent-brand/10 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-accent-brand">Total Required Headroom</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-text-primary">22 - 28 GB</div>
                        <div className="mt-1 font-mono text-xs text-text-secondary">Recommended 32GB VRAM (RTX 5090) provides 4-10GB headroom for concurrent batching.</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border-dim">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                          <tr>
                            <th className="px-3 py-2">GPU Hardware</th>
                            <th className="px-3 py-2">Architecture</th>
                            <th className="px-3 py-2">VRAM</th>
                            <th className="px-3 py-2">Token Speed</th>
                            <th className="px-3 py-2">Node Tier</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dim text-text-secondary">
                          <tr className="bg-accent-brand/10 font-medium text-text-primary">
                            <td className="px-3 py-2">NVIDIA RTX 5090</td>
                            <td className="px-3 py-2">Blackwell GB202</td>
                            <td className="px-3 py-2">32GB GDDR7 (~1.8 TB/s)</td>
                            <td className="px-3 py-2">~120-180 tok/s</td>
                            <td className="px-3 py-2"><Badge variant="success" className="text-[10px]">Official Baseline</Badge></td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2">NVIDIA A100 80GB / H100 80GB</td>
                            <td className="px-3 py-2">Hopper / Ampere</td>
                            <td className="px-3 py-2">80GB HBM3</td>
                            <td className="px-3 py-2">~150-220 tok/s</td>
                            <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Enterprise Tier Supported</Badge></td>
                          </tr>
                          <tr className="opacity-70">
                            <td className="px-3 py-2">NVIDIA RTX 4090 / 3090 (24GB)</td>
                            <td className="px-3 py-2">Ada / Ampere</td>
                            <td className="px-3 py-2">24GB GDDR6X</td>
                            <td className="px-3 py-2">~70-100 tok/s</td>
                            <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Community Tier (Limited Ctx)</Badge></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Installation Section */}
                <Card id="prov-install" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Terminal className="h-4 w-4 text-accent-brand" /> One-Liner Installation Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CodeBlock label="Recommended execution command (Ubuntu 24.04+)" code={ONE_LINER_RECOMMENDED} />
                    <div className="rounded-lg border border-border-dim bg-bg-primary p-4 space-y-2">
                      <div className="font-mono text-xs font-bold text-text-primary">What does install.sh execute?</div>
                      <ol className="list-decimal pl-5 font-mono text-xs leading-5 text-text-secondary space-y-1">
                        <li>Verifies NVIDIA driver (Driver ≥580.65, CUDA 13.3) and available VRAM headroom (&gt;22GB).</li>
                        <li>Automatically pulls and configures isolated <code className="rounded bg-bg-tertiary px-1">tailscale-seedinfer</code> container (preserving home network state).</li>
                        <li>Generates Ed25519 keypair and calculates unique SHA-256 Hardware Fingerprint.</li>
                        <li>Launches vLLM engine with NVFP4 support for Gemma 4 26B and registers active heartbeats with gateway.</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>

                {/* Provider FAQ */}
                <Card id="prov-faq" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <HelpCircle className="h-4 w-4 text-accent-brand" /> Provider FAQ — Frequently Asked Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FaqItem
                      question="How are provider earnings paid out?"
                      answer={
                        <div className="space-y-1.5">
                          <p>
                            Payouts are distributed in <strong>USDC / ETH on the Base network (Base Chain)</strong>.
                          </p>
                          <p className="text-accent-amber font-semibold">
                            ⚠️ Mandatory Payout Requirement: To receive your automated monthly retainer ($0.40/day) and 99% net token execution earnings, you MUST enter a valid EVM crypto wallet address on the Base Chain in your <a href="/provider/portal" className="underline text-accent-brand">Provider Portal</a>.
                          </p>
                          <p>
                            Retainers and profit shares accrue continuously and are settled automatically to your registered Base Chain address.
                          </p>
                        </div>
                      }
                    />
                    <FaqItem
                      question="Do I need to open router ports (Port Forwarding / Public IP)?"
                      answer={
                        <p>
                          <strong>No.</strong> Connectivity between the SeedInfer gateway and your node operates through an outbound encrypted WireGuard tunnel (Tailscale Headscale). Nodes do not require public IP addresses or inbound port forwarding.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How does the Hardware Fingerprint Lock work?"
                      answer={
                        <p>
                          On initial startup, the agent registers a unique hardware hash bound to your GPU and CPU UUIDs. This prevents unauthorized cloning of your private key or container onto another machine.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Can I run a node on an RTX 4090 or 3090 (24GB VRAM)?"
                      answer={
                        <p>
                          Yes, but 24GB cards operate under the <i>Community Tier</i>. It requires setting context limit in config to <code className="rounded bg-bg-tertiary px-1">VLLM_MAX_MODEL_LEN=131072</code> and <code className="rounded bg-bg-tertiary px-1">VLLM_GPU_MEMORY_UTILIZATION=0.80</code> to prevent Out Of Memory (OOM) exceptions.
                        </p>
                      }
                    />
                    <FaqItem
                      question="What happens if my node goes offline or loses internet?"
                      answer={
                        <p>
                          The SeedInfer gateway simply stops routing traffic to your node. There are no financial slashing penalties. Standby retainers accrue for each complete hour of availability with uptime &ge;50%.
                        </p>
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: CLIENT DOCUMENTATION                                                */}
            {/* ========================================================================= */}
            {tab === "client" && (
              <div className="space-y-6">
                {/* Client Hero Card */}
                <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="success" className="gap-1">
                            <Zap className="h-3 w-3" /> OpenAI API Compatible
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Base URL: https://seedinfer.com/v1
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Zero-Data Logging
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                            EWMA Low Latency Routing
                          </Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-primary">
                          Client API Integration & Developer SDKs
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                          Integrate with the SeedInfer network in seconds. The API is 100% compliant with OpenAI and OpenRouter v2.4 specifications. Simply substitute the <code className="rounded bg-bg-tertiary px-1">base_url</code> in your standard <code className="rounded bg-bg-tertiary px-1">openai</code> SDK.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href="#cli-quickstart" className="inline-flex items-center gap-1 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover">
                            <Code2 className="h-3.5 w-3.5" /> API Quickstart ↓
                          </a>
                          <a href="#cli-models" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            Models & Rates ↓
                          </a>
                          <a href="#cli-faq" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            <HelpCircle className="h-3.5 w-3.5 text-accent-brand" /> Client FAQ ↓
                          </a>
                        </div>
                      </div>

                      <Card className="w-full shrink-0 border border-border-dim bg-bg-primary/60 lg:w-[380px]">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                            <Globe className="h-3.5 w-3.5 text-accent-brand" /> API Connection Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 pt-0 font-mono text-xs">
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">API Endpoint</span>
                            <span className="font-semibold text-accent-brand">https://seedinfer.com/v1</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Request Format</span>
                            <span className="font-semibold text-text-primary">OpenAI / OpenRouter JSON</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Streaming (SSE)</span>
                            <span className="font-semibold text-accent-green">Supported (stream: true)</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Data Privacy</span>
                            <span className="font-semibold text-text-primary">Zero Logging (RAM Only)</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {/* API Code Examples */}
                <Card id="cli-quickstart" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Code2 className="h-4 w-4 text-accent-brand" /> Code Examples (Python, Node.js, cURL)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Tabs defaultValue="python" className="w-full">
                      <TabsList className="bg-bg-tertiary border border-border-dim p-1">
                        <TabsTrigger value="python" className="text-xs font-mono">Python SDK</TabsTrigger>
                        <TabsTrigger value="curl" className="text-xs font-mono">cURL</TabsTrigger>
                        <TabsTrigger value="javascript" className="text-xs font-mono">Node.js / JS</TabsTrigger>
                      </TabsList>
                      <TabsContent value="python" className="mt-3">
                        <CodeBlock label="Python (pip install openai)" code={PYTHON_EXAMPLE} />
                      </TabsContent>
                      <TabsContent value="curl" className="mt-3">
                        <CodeBlock label="Bash / cURL" code={CURL_EXAMPLE} />
                      </TabsContent>
                      <TabsContent value="javascript" className="mt-3">
                        <CodeBlock label="JavaScript (npm install openai)" code={JS_EXAMPLE} />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Models Catalog */}
                <Card id="cli-models" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Cpu className="h-4 w-4 text-accent-brand" /> Available Models & API Rates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto rounded-xl border border-border-dim">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                          <tr>
                            <th className="px-3 py-2">Model ID</th>
                            <th className="px-3 py-2">Context Window</th>
                            <th className="px-3 py-2">Input Price / 1M</th>
                            <th className="px-3 py-2">Output Price / 1M</th>
                            <th className="px-3 py-2">Specialization</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dim text-text-secondary">
                          <tr className="bg-accent-brand/5 font-medium text-text-primary">
                            <td className="px-3 py-2 flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] bg-accent-brand/10 text-accent-brand">Recommended Phase 0</Badge>
                              google/gemma-4-26b-a4b-nvfp4
                            </td>
                            <td className="px-3 py-2">256,000 tokens</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.03</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.20</td>
                            <td className="px-3 py-2">Fast reasoning, multilingual agentic tasks</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium">nvidia/nemotron-lightning-1m</td>
                            <td className="px-3 py-2">1,000,000 tokens</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.02</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.05</td>
                            <td className="px-3 py-2">Ultra-long context, document analysis, coding</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Client FAQ */}
                <Card id="cli-faq" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <HelpCircle className="h-4 w-4 text-accent-brand" /> Client FAQ — Frequently Asked Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FaqItem
                      question="Are my prompts and completions logged or stored on node disks?"
                      answer={
                        <p>
                          <strong>No.</strong> SeedInfer operates on strict <i>Zero-Data Logging</i> principles. Prompts are processed strictly in volatile GPU RAM/VRAM. No node has permission or capability to write request payloads to persistent disk.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Does SeedInfer work with frameworks like LangChain, AutoGen, or OpenCode?"
                      answer={
                        <p>
                          Yes! Since the API uses standard OpenAI Chat Completions protocol, simply set <code className="rounded bg-bg-tertiary px-1">OPENAI_BASE_URL=https://seedinfer.com/v1</code> and supply your API key in your configuration.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How does network routing evaluate provider latency?"
                      answer={
                        <p>
                          The SeedInfer gateway uses an <strong>EWMA (Exponentially Weighted Moving Average)</strong> algorithm to continuously monitor Time to First Token (TTFT) and active throughput. Requests are dynamically routed to the nearest, most performant node.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How do Subscription API keys differ from Pay-As-You-Go API keys?"
                      answer={
                        <p>
                          Subscriptions (GO, GOAT, PRO) issue dedicated API keys starting with <code className="rounded bg-bg-tertiary px-1">sk_sub_...</code>. Pay-As-You-Go credit balances use standard keys (<code className="rounded bg-bg-tertiary px-1">sk_live_...</code>). Subscription keys are strictly tied to monthly package quotas and billing.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How does the Orange Pi 4 Pro router prioritize Subscription vs Pay-As-You-Go requests?"
                      answer={
                        <p>
                          On the Orange Pi 4 Pro routing layer, requests authenticated with subscription keys (<code className="rounded bg-bg-tertiary px-1">sk_sub_...</code>) are assigned <strong>lowest / background priority</strong> (<code className="rounded bg-bg-tertiary px-1">X-SeedInfer-Priority: background</code>). Pay-As-You-Go traffic receives top priority, guaranteeing low latency for pay-per-token clients while giving subscribers discounted 2x–4x volume multipliers at background queue priority.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How do I obtain an API Key?"
                      answer={
                        <p>
                          During the beta rollout, a public demo key <code className="rounded bg-bg-tertiary px-1">sk-seedinfer-demo</code> is enabled. You can also manage Pay-As-You-Go and Subscription keys in the <Link href="/settings" className="text-accent-brand underline">Settings</Link> and <Link href="/api-console" className="text-accent-brand underline">API Console</Link>.
                        </p>
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Documentation Center (Provider & Client) · Built for Decentralized AI Privacy & Economics
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

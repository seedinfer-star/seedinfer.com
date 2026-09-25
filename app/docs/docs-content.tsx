"use client"

import { useState } from "react"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer } from "@/components/app-shell"
import ProviderContactForm from "@/components/provider-contact-form"
import {
  MODELS,
  LIVE_MODEL,
  API_BASE_URL,
  GPU_SPECS,
  REFERENCE_GPU,
  MIN_VRAM_GB,
  PROVIDER_ECONOMICS,
  REVENUE_SHARE_PCT,
  PROTOCOL_FEE_PCT,
  STANDBY_LABEL,
  PAYOUT_LABEL,
  CACHE_POLICY,
  SUBSCRIPTION_PLANS,
  usd,
} from "@/lib/catalog"
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

const ONE_LINER_RECOMMENDED = `curl -fsSL https://seedinfer.com/install.sh | SEEDINFER_NODE_TOKEN=sipn_YOUR_TOKEN bash`
const API_KEY_PLACEHOLDER = "sk-seedinfer-...YOUR_KEY"

const PYTHON_EXAMPLE = `import openai

client = openai.OpenAI(
    base_url="${API_BASE_URL}",
    api_key="${API_KEY_PLACEHOLDER}",
)

response = client.chat.completions.create(
    model="${LIVE_MODEL.id}",
    messages=[
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": "Explain quantum computing in two sentences."}
    ],
    temperature=0.7,
    max_tokens=150,
)

print(response.choices[0].message.content)`

const CURL_EXAMPLE = `curl -X POST ${API_BASE_URL}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${API_KEY_PLACEHOLDER}" \\
  -d '{
    "model": "${LIVE_MODEL.id}",
    "messages": [{"role": "user", "content": "Hello SeedInfer!"}],
    "stream": false
  }'`

const JS_EXAMPLE = `import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: '${API_BASE_URL}',
  apiKey: '${API_KEY_PLACEHOLDER}',
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Hello SeedInfer!' }],
    model: '${LIVE_MODEL.id}',
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
    <AppShell>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            SeedInfer Documentation
            <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px] border-accent-brand/30 text-accent-brand">
              API v1 · OpenAI-compatible
            </Badge>
          </span>
        }
        actions={
          <>
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
          </>
        }
      />
      <PageContainer>
            <div className="text-center max-w-2xl mx-auto space-y-2 pt-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider text-accent-brand border-accent-brand/30 bg-accent-brand/10">
                Choose a section
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">SeedInfer technical documentation</h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-5">
                Guides for GPU node operators (providers) and for developers integrating the API (clients).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto">
              {(
                [
                  {
                    key: "provider" as const,
                    icon: <Server className="h-5 w-5" />,
                    title: "Provider documentation",
                    badge: "Nodes & hardware",
                    desc: (
                      <>
                        For GPU owners and node operators: <code className="rounded bg-bg-tertiary px-1">install.sh</code>, hardware requirements
                        (NVIDIA ≥{MIN_VRAM_GB}GB VRAM), Ed25519 identity, hardware fingerprint, payouts and FAQ.
                      </>
                    ),
                  },
                  {
                    key: "client" as const,
                    icon: <Code2 className="h-5 w-5" />,
                    title: "Client documentation",
                    badge: "API & integration",
                    desc: (
                      <>
                        For developers: OpenAI SDK integration, Python / cURL / JS examples, the{" "}
                        <code className="rounded bg-bg-tertiary px-1">/v1/chat/completions</code> endpoint, pricing and FAQ.
                      </>
                    ),
                  },
                ]
              ).map((c) => (
                <button
                  key={c.key}
                  onClick={() => setTab(c.key)}
                  className={`relative flex flex-col items-start p-5 rounded-2xl border text-left transition-all duration-200 shadow-md ${
                    tab === c.key
                      ? "border-accent-brand bg-gradient-to-br from-accent-brand/15 via-bg-secondary to-bg-secondary ring-2 ring-accent-brand/40"
                      : "border-border-dim bg-bg-secondary hover:border-border-default hover:bg-bg-tertiary/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                        tab === c.key ? "bg-accent-brand text-white border-accent-brand" : "bg-bg-tertiary text-text-secondary border-border-default"
                      }`}
                    >
                      {c.icon}
                    </div>
                    <Badge variant={tab === c.key ? "success" : "outline"} className="font-mono text-[10px]">
                      {tab === c.key ? "Active section" : c.badge}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-text-primary flex items-center gap-2">
                    {c.title}
                    <ArrowRight className={`h-4 w-4 transition-transform ${tab === c.key ? "translate-x-1 text-accent-brand" : "text-text-tertiary"}`} />
                  </h3>
                  <p className="mt-1 font-mono text-xs text-text-secondary leading-5">{c.desc}</p>
                </button>
              ))}
            </div>

            <div className="border-t border-border-dim/60 pt-4" />

            {tab === "provider" && (
              <div className="space-y-6">
                <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="success" className="gap-1">
                            <ShieldCheck className="h-3 w-3" /> No account needed
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">Ed25519 key pair</Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">Hardware fingerprint</Badge>
                          <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                            CUDA 13.3 · driver 580+
                          </Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-primary">Provider node setup & hardware guide</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                          Serve {LIVE_MODEL.name} on your NVIDIA GPU. No email registration: your identity is an{" "}
                          <strong className="text-text-primary">Ed25519 key pair</strong> bound to your machine by a{" "}
                          <strong className="text-text-primary">SHA-256 hardware fingerprint</strong>. You earn {REVENUE_SHARE_PCT}% of the token
                          revenue your node serves plus a standby retainer of {STANDBY_LABEL}.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href="#prov-hardware" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            Hardware ↓
                          </a>
                          <a href="#prov-install" className="inline-flex items-center gap-1 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover">
                            <Terminal className="h-3.5 w-3.5" /> Quick install ↓
                          </a>
                          <a href="#prov-faq" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            <HelpCircle className="h-3.5 w-3.5 text-accent-brand" /> Provider FAQ ↓
                          </a>
                        </div>
                      </div>

                      <Card className="w-full shrink-0 border border-border-dim bg-bg-primary/60 lg:w-[380px]">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                            <ShieldCheck className="h-3.5 w-3.5 text-accent-brand" /> Node requirements
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 pt-0 font-mono text-xs">
                          {[
                            ["Minimum GPU", `NVIDIA, ≥${MIN_VRAM_GB}GB VRAM`],
                            ["Reference node", REFERENCE_GPU.name],
                            ["Identity", "Ed25519 key pair"],
                            ["OS & driver", "Ubuntu 24.04+ / driver 580+"],
                            ["Payouts", `${PROVIDER_ECONOMICS.payoutAsset} on ${PROVIDER_ECONOMICS.payoutChain}, ${PROVIDER_ECONOMICS.payoutCadence}`],
                          ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-2 rounded-lg bg-bg-tertiary px-2.5 py-2">
                              <span className="text-text-tertiary">{k}</span>
                              <span className="font-semibold text-text-primary text-right">{v}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Lock className="h-4 w-4 text-accent-brand" /> Identity & hardware lock
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                          <KeyRound className="h-4 w-4 text-accent-brand" /> 1. Ed25519 keys
                        </div>
                        <p className="font-mono text-xs leading-5 text-text-secondary">On first start the installer generates a key pair:</p>
                        <ul className="list-disc pl-5 font-mono text-[11px] leading-4 text-text-tertiary space-y-1">
                          <li><strong>Private key:</strong> stored locally with 0600 permissions. It never leaves your server and signs heartbeats.</li>
                          <li><strong>Public key:</strong> your node&apos;s only identifier on the network. Earnings are tracked against it.</li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                          <ShieldCheck className="h-4 w-4 text-accent-green" /> 2. Hardware fingerprint
                        </div>
                        <p className="font-mono text-xs leading-5 text-text-secondary">The agent derives a fingerprint from the GPU UUID, PCIe bus and machine id:</p>
                        <ul className="list-disc pl-5 font-mono text-[11px] leading-4 text-text-tertiary space-y-1">
                          <li>The SHA-256 fingerprint is bound to your public key on first registration.</li>
                          <li>This prevents cloning the container or key onto another machine.</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card id="prov-hardware" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <HardDrive className="h-4 w-4 text-accent-brand" /> VRAM requirement & supported GPUs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="font-mono text-xs leading-5 text-text-secondary">
                      {LIVE_MODEL.name} (NVFP4 weights, FP8 KV cache, {LIVE_MODEL.contextLabel} context) needs at least{" "}
                      <strong className="text-text-primary">{MIN_VRAM_GB}GB VRAM</strong>. 24GB cards are not supported yet (roadmap).
                    </p>
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
                            <tr key={g.key} className={g.key === REFERENCE_GPU.key ? "bg-accent-brand/10 font-medium text-text-primary" : g.supported ? "" : "opacity-70"}>
                              <td className="px-3 py-2">{g.name}</td>
                              <td className="px-3 py-2">{g.vramGb}GB</td>
                              <td className="px-3 py-2">{g.tdpW} W</td>
                              <td className="px-3 py-2">
                                <Badge variant={g.key === REFERENCE_GPU.key ? "success" : "outline"} className="text-[10px]">
                                  {g.note || (g.supported ? "Supported" : "Roadmap")}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <section id="custom-application-form" className="scroll-mt-4">
                  <ProviderContactForm />
                </section>

                <Card id="prov-install" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Terminal className="h-4 w-4 text-accent-brand" /> Installation (one command)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="font-mono text-xs leading-5 text-text-secondary">
                      Create a node token in the{" "}
                      <Link href="/provider/portal" className="text-accent-brand underline">Provider portal (sign-in required)</Link>{" "}
                      and pass it to the installer.
                    </p>
                    <CodeBlock label="Recommended command (Ubuntu 24.04+)" code={ONE_LINER_RECOMMENDED} />
                    <div className="rounded-lg border border-border-dim bg-bg-primary p-4 space-y-2">
                      <div className="font-mono text-xs font-bold text-text-primary">What does install.sh do?</div>
                      <ol className="list-decimal pl-5 font-mono text-xs leading-5 text-text-secondary space-y-1">
                        <li>Checks the NVIDIA driver (≥580, CUDA 13.3) and that the GPU has at least {MIN_VRAM_GB}GB VRAM.</li>
                        <li>Sets up an isolated mesh VPN container (<code className="rounded bg-bg-tertiary px-1">tailscale-seedinfer</code>); an existing VPN on the host keeps working.</li>
                        <li>Generates the Ed25519 key pair and the SHA-256 hardware fingerprint.</li>
                        <li>Starts vLLM with {LIVE_MODEL.name} and begins sending heartbeats to the gateway.</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>

                <Card id="prov-faq" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <HelpCircle className="h-4 w-4 text-accent-brand" /> Provider FAQ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FaqItem
                      question="How and when am I paid?"
                      answer={
                        <p>
                          You receive <strong>{REVENUE_SHARE_PCT}% of the token revenue</strong> your node serves ({PROTOCOL_FEE_PCT}% protocol fee) plus a
                          standby retainer of {STANDBY_LABEL}. Payouts are made in <strong>{PROVIDER_ECONOMICS.payoutAsset} on {PROVIDER_ECONOMICS.payoutChain}</strong>,{" "}
                          {PROVIDER_ECONOMICS.payoutCadence}, with a minimum of ${PROVIDER_ECONOMICS.minPayoutUsd.toFixed(2)} (smaller balances carry over). Fiat payouts are not available.
                          To receive payouts you must register an EVM wallet address on {PROVIDER_ECONOMICS.payoutChain} in the{" "}
                          <Link href="/provider/portal" className="text-accent-brand underline">Provider Portal</Link>.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Do I need to open ports or have a public IP?"
                      answer={
                        <p>
                          <strong>No.</strong> The gateway reaches your node over an outbound, encrypted WireGuard mesh. No public IP or inbound port forwarding is required.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How does the hardware lock work?"
                      answer={
                        <p>
                          On first start the agent registers a hash of your GPU and machine identifiers. This stops anyone from cloning your private key or
                          container and running a second node under the same identity.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Can I run a node on an RTX 4090 or 3090 (24GB VRAM)?"
                      answer={
                        <p>
                          Not yet. {LIVE_MODEL.name} requires at least {MIN_VRAM_GB}GB VRAM. Support for 24GB cards is on the roadmap.
                        </p>
                      }
                    />
                    <FaqItem
                      question="What happens if I turn off my machine or lose connectivity?"
                      answer={
                        <p>
                          The gateway simply stops routing traffic to your node; there is no slashing. A node with no heartbeat for 5 minutes is shown as
                          offline. The standby retainer is paid for each day with ≥{Math.round(PROVIDER_ECONOMICS.standbyMinUptime * 100)}% uptime.
                        </p>
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === "client" && (
              <div className="space-y-6">
                <Card className="overflow-hidden border border-accent-brand/20 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="success" className="gap-1">
                            <Zap className="h-3 w-3" /> OpenAI API compatible
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">Base URL: {API_BASE_URL}</Badge>
                          <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/30 text-accent-brand">
                            Latency-aware routing
                          </Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-primary">Client API integration</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                          The SeedInfer API follows the OpenAI Chat Completions format. Point the standard <code className="rounded bg-bg-tertiary px-1">openai</code>{" "}
                          SDK at <code className="rounded bg-bg-tertiary px-1">base_url={API_BASE_URL}</code> and use your API key.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href="#cli-quickstart" className="inline-flex items-center gap-1 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover">
                            <Code2 className="h-3.5 w-3.5" /> API quickstart ↓
                          </a>
                          <a href="#cli-models" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            Models & pricing ↓
                          </a>
                          <a href="#cli-faq" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            <HelpCircle className="h-3.5 w-3.5 text-accent-brand" /> Client FAQ ↓
                          </a>
                        </div>
                      </div>

                      <Card className="w-full shrink-0 border border-border-dim bg-bg-primary/60 lg:w-[380px]">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-text-tertiary">
                            <Globe className="h-3.5 w-3.5 text-accent-brand" /> Connection details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 pt-0 font-mono text-xs">
                          {[
                            ["Base URL", API_BASE_URL],
                            ["Format", "OpenAI Chat Completions"],
                            ["Streaming (SSE)", "Supported (stream: true)"],
                            ["Live model", LIVE_MODEL.id],
                          ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-2 rounded-lg bg-bg-tertiary px-2.5 py-2">
                              <span className="text-text-tertiary">{k}</span>
                              <span className="font-semibold text-text-primary text-right break-all">{v}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                <Card id="cli-quickstart" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Code2 className="h-4 w-4 text-accent-brand" /> Code examples (Python, Node.js, cURL)
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

                <Card id="cli-models" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Cpu className="h-4 w-4 text-accent-brand" /> Models & API pricing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="overflow-x-auto rounded-xl border border-border-dim">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                          <tr>
                            <th className="px-3 py-2">Model id</th>
                            <th className="px-3 py-2">Context</th>
                            <th className="px-3 py-2">Input / 1M</th>
                            <th className="px-3 py-2">Output / 1M</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dim text-text-secondary">
                          {MODELS.map((m) => (
                            <tr key={m.id} className={m.status === "live" ? "bg-accent-brand/5 font-medium text-text-primary" : ""}>
                              <td className="px-3 py-2">
                                <div>{m.id}</div>
                                {m.status === "live" && m.aliases.length > 0 && (
                                  <div className="text-[10px] text-text-tertiary">aliases: {m.aliases.join(", ")}</div>
                                )}
                              </td>
                              <td className="px-3 py-2">{m.contextLength.toLocaleString("en-US")} tokens</td>
                              <td className="px-3 py-2 text-accent-green font-semibold">{usd(m.pricePer1M.input)}</td>
                              <td className="px-3 py-2 text-accent-green font-semibold">{usd(m.pricePer1M.output)}</td>
                              <td className="px-3 py-2">
                                <Badge variant={m.status === "live" ? "success" : "outline"} className="text-[10px]">
                                  {m.status === "live" ? "live" : "coming soon"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="font-mono text-[11px] text-text-tertiary">{CACHE_POLICY.label}. Minimum invoice for credit top-ups is $0.10.</p>
                  </CardContent>
                </Card>

                <Card id="cli-faq" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <HelpCircle className="h-4 w-4 text-accent-brand" /> Client FAQ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FaqItem
                      question="Are my prompts and completions stored on provider nodes?"
                      answer={
                        <p>
                          Nodes process requests in GPU/host memory to serve them; the provider agent does not write prompt or completion content to disk.
                          The KV cache (used for cached-input pricing) lives in memory for up to {CACHE_POLICY.maxSeconds / 60} minutes.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Does SeedInfer work with LangChain, AutoGen, OpenCode and similar tools?"
                      answer={
                        <p>
                          Yes. Because the API uses the OpenAI Chat Completions format, set{" "}
                          <code className="rounded bg-bg-tertiary px-1">OPENAI_BASE_URL={API_BASE_URL}</code> and your SeedInfer API key.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How does routing pick a provider?"
                      answer={
                        <p>
                          The gateway tracks each node&apos;s time to first token (TTFT) with an exponentially weighted moving average (EWMA) and its current
                          load, and routes each request to the best available verified node.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How do subscription keys differ from pay-as-you-go keys?"
                      answer={
                        <p>
                          Subscriptions (GO, GOAT, PRO) use dedicated keys starting with <code className="rounded bg-bg-tertiary px-1">sk_sub_...</code> that draw
                          from the monthly plan quota. Pay-as-you-go keys (<code className="rounded bg-bg-tertiary px-1">sk_live_...</code>) draw from your credit
                          balance. See <Link href="/billing" className="text-accent-brand underline">Billing</Link> for plan details.
                        </p>
                      }
                    />
                    <FaqItem
                      question="How are subscription and pay-as-you-go requests prioritized?"
                      answer={
                        <p>
                          Requests made with subscription keys are routed at background priority (
                          <code className="rounded bg-bg-tertiary px-1">X-SeedInfer-Priority: background</code>). Pay-as-you-go traffic gets standard (highest)
                          priority, which keeps its latency low at peak demand; subscribers get {SUBSCRIPTION_PLANS[0].multiplier}x–
                          {SUBSCRIPTION_PLANS[SUBSCRIPTION_PLANS.length - 1].multiplier}x more usage per dollar in exchange.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Where do I get an API key?"
                      answer={
                        <p>
                          Create an account via <Link href="/register" className="text-accent-brand underline">Register</Link>. Self-service key management in{" "}
                          <Link href="/settings" className="text-accent-brand underline">Settings</Link> is coming soon; you can test requests in the{" "}
                          <Link href="/api-console" className="text-accent-brand underline">API Console</Link>.
                        </p>
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Documentation · Payouts: {PAYOUT_LABEL}
            </div>
      </PageContainer>
    </AppShell>
  )
}

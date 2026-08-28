"use client"

import { useState } from "react"
import Link from "next/link"
import Sidebar from "@/components/sidebar"
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
    api_key="sk-seedinfer-demo" # lub Twój dedykowany klucz API
)

response = client.chat.completions.create(
    model="seedinfer/nemotron-lightning-1m",
    messages=[
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": "Wyjaśnij obliczenia kwantowe w 2 zdaniach."}
    ],
    temperature=0.7,
    max_tokens=150
)

print(response.choices[0].message.content)`

const CURL_EXAMPLE = `curl -X POST https://seedinfer.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-seedinfer-demo" \\
  -d '{
    "model": "seedinfer/nemotron-lightning-1m",
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
    messages: [{ role: 'user', content: 'Cześć SeedInfer!' }],
    model: 'seedinfer/nemotron-lightning-1m',
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
  const [tab, setTab] = useState<"provider" | "client">("provider")

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
                Wybierz sekcję dokumentacji
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Dokumentacja Techniczna SeedInfer
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-5">
                Kompleksowe przewodniki dla operatorów węzłów sprzętowych (Provider) oraz programistów integrujących API (Client).
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
                    {tab === "provider" ? "Aktywna Sekcja" : "Węzły & Sprzęt"}
                  </Badge>
                </div>

                <h3 className="mt-4 text-base font-bold text-text-primary flex items-center gap-2">
                  Provider Documentation
                  <ArrowRight className={`h-4 w-4 transition-transform ${tab === "provider" ? "translate-x-1 text-accent-brand" : "text-text-tertiary"}`} />
                </h3>
                <p className="mt-1 font-mono text-xs text-text-secondary leading-5">
                  Dla Dostawców Sprzętu i Operatorów Węzłów. Instrukcja instalacji <code className="rounded bg-bg-tertiary px-1">install.sh</code>, wymogi RTX 5090 32GB, archiwum autoryzacji Ed25519, odcisk sprzętowy i FAQ dla dostawców.
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
                    {tab === "client" ? "Aktywna Sekcja" : "API & Integracja"}
                  </Badge>
                </div>

                <h3 className="mt-4 text-base font-bold text-text-primary flex items-center gap-2">
                  Client Documentation
                  <ArrowRight className={`h-4 w-4 transition-transform ${tab === "client" ? "translate-x-1 text-accent-brand" : "text-text-tertiary"}`} />
                </h3>
                <p className="mt-1 font-mono text-xs text-text-secondary leading-5">
                  Dla Programistów i Użytkowników API. Integracja OpenAI SDK, przykłady w Python, cURL i JS, specyfikacja endpointu <code className="rounded bg-bg-tertiary px-1">/v1/chat/completions</code>, cenniki i FAQ dla klientów.
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
                            <ShieldCheck className="h-3.5 w-3.5 text-accent-brand" /> Quick Node Specs
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 pt-0 font-mono text-xs">
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Minimum GPU</span>
                            <span className="font-semibold text-accent-brand">RTX 5090 (32GB VRAM)</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Auth System</span>
                            <span className="font-semibold text-text-primary">Ed25519 Keypair (Zero-Account)</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Hardware Locking</span>
                            <span className="font-semibold text-text-primary">SHA-256 GPU/CPU Fingerprint</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">OS & Driver</span>
                            <span className="font-semibold text-text-primary">Ubuntu 24.04+ / Driver 580+</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Payout Currency</span>
                            <span className="font-semibold text-accent-green">USDC on Base Network</span>
                          </div>
                        </CardContent>
                      </Card>
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
                          Przy pierwszym uruchomieniu plik instalacyjny generuje parę kluczy w <code className="rounded bg-bg-tertiary px-1">/etc/seedinfer/identity.key</code>:
                        </p>
                        <ul className="list-disc pl-5 font-mono text-[11px] leading-4 text-text-tertiary space-y-1">
                          <li><strong>Klucz Prywatny (Private Key):</strong> Zapisany lokalnie z uprawnieniami 0600. Nigdy nie opuszcza Twojego serwera. Służy do podpisywania heartbeatów.</li>
                          <li><strong>Klucz Publiczny (Public Key):</strong> Twój jedyny identyfikator w sieci (Zero-Account ID). Na ten adres wysyłane są miesięczne wypłaty USDC na Base.</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                          <ShieldCheck className="h-4 w-4 text-accent-green" /> 2. Hardware Fingerprint Lock
                        </div>
                        <p className="font-mono text-xs leading-5 text-text-secondary">
                          Agent buduje unikalny odcisk cyfrowy sprzętu na podstawie UUID GPU, serialu płyty i identyfikatora CPU:
                        </p>
                        <ul className="list-disc pl-5 font-mono text-[11px] leading-4 text-text-tertiary space-y-1">
                          <li>Odcisk SHA-256 jest wiązany z Twoim kluczem publicznym podczas pierwszej rejestracji.</li>
                          <li>Uniemożliwia to sklonowanie kontenera lub uruchomienie wirtualnej kopii węzła na innym komputerze.</li>
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
                        <div className="mt-1 font-mono text-xs text-text-secondary">W4A16 + FP8 via ModelOpt. Ściąganie ~20-30GB z HuggingFace cache.</div>
                      </div>
                      <div className="rounded-xl border border-border-dim bg-bg-primary p-4">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">KV Cache (1M Context)</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-text-primary">~6 - 10 GB</div>
                        <div className="mt-1 font-mono text-xs text-text-secondary">FP8 KV cache z flagami <code className="rounded bg-bg-tertiary px-1">--kv-cache-dtype fp8</code>.</div>
                      </div>
                      <div className="rounded-xl border border-accent-brand/20 bg-accent-brand/10 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-accent-brand">Total Required Headroom</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-text-primary">22 - 28 GB</div>
                        <div className="mt-1 font-mono text-xs text-text-secondary">Rekomendowane 32GB VRAM (RTX 5090) daje 4-10GB zapasu na równoległe zapytania batching.</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border-dim">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                          <tr>
                            <th className="px-3 py-2">Karta GPU</th>
                            <th className="px-3 py-2">Architektura</th>
                            <th className="px-3 py-2">VRAM</th>
                            <th className="px-3 py-2">Wydajność Tokenów</th>
                            <th className="px-3 py-2">Status Węzła</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dim text-text-secondary">
                          <tr className="bg-accent-brand/10 font-medium text-text-primary">
                            <td className="px-3 py-2">NVIDIA RTX 5090</td>
                            <td className="px-3 py-2">Blackwell GB202</td>
                            <td className="px-3 py-2">32GB GDDR7 (~1.8 TB/s)</td>
                            <td className="px-3 py-2">~120-180 tok/s</td>
                            <td className="px-3 py-2"><Badge variant="success" className="text-[10px]">Oficjalny Minimum</Badge></td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2">NVIDIA A100 80GB / H100 80GB</td>
                            <td className="px-3 py-2">Hopper / Ampere</td>
                            <td className="px-3 py-2">80GB HBM3</td>
                            <td className="px-3 py-2">~150-220 tok/s</td>
                            <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Wspierany Tier Enterprise</Badge></td>
                          </tr>
                          <tr className="opacity-70">
                            <td className="px-3 py-2">NVIDIA RTX 4090 / 3090 (24GB)</td>
                            <td className="px-3 py-2">Ada / Ampere</td>
                            <td className="px-3 py-2">24GB GDDR6X</td>
                            <td className="px-3 py-2">~70-100 tok/s</td>
                            <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">Community Tier (Ograniczony Ctx)</Badge></td>
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
                      <Terminal className="h-4 w-4 text-accent-brand" /> Instrukcja Instalacji (Jedna Komenda)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CodeBlock label="Rekomendowana komenda uruchomieniowa (Ubuntu 24.04+)" code={ONE_LINER_RECOMMENDED} />
                    <div className="rounded-lg border border-border-dim bg-bg-primary p-4 space-y-2">
                      <div className="font-mono text-xs font-bold text-text-primary">Co robi plik install.sh?</div>
                      <ol className="list-decimal pl-5 font-mono text-xs leading-5 text-text-secondary space-y-1">
                        <li>Weryfikuje sterownik NVIDIA (Driver ≥580.65, CUDA 13.3) i dostępność wolnego VRAM (&gt;22GB).</li>
                        <li>Automatycznie pobiera i konfiguruje odizolowany kontener <code className="rounded bg-bg-tertiary px-1">tailscale-seedinfer</code> (zachowując nienaruszoną domową sieć Tailscale 100.94.x.x).</li>
                        <li>Generuje parę kluczy Ed25519 oraz wylicza unikalny SHA-256 odcisk sprzętowy (Hardware Fingerprint).</li>
                        <li>Uruchamia vLLM nightly ze wsparciem NVFP4 dla Nemotron 3.5 30B / Gemma 4 i wysyła heartbeat do bramki.</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>

                {/* Provider FAQ */}
                <Card id="prov-faq" className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <HelpCircle className="h-4 w-4 text-accent-brand" /> Provider FAQ — Najczęściej Zadawane Pytania
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FaqItem
                      question="Jak odbywają się wypłaty wynagrodzenia?"
                      answer={
                        <p>
                          Wypłaty realizowane są w stabilnej kryptowalucie <strong>USDC w sieci Base</strong>. System podlicza godziny przepracowane na gotowości (standby retainer $0.40/dzień) oraz wygenerowany wolumen tokenów i wysyła fundusze 1. dnia każdego miesiąca bezpośrednio na Twój adres klucza publicznego Ed25519.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Czy muszę otwierać porty na routerze (Port Forwarding / Public IP)?"
                      answer={
                        <p>
                          <strong>Nie.</strong> Połączenie między bramką SeedInfer a Twoim węzłem odbywa się przez wychodzący zaszyfrowany tunel WireGuard (Tailscale Headscale). Węzeł nie wymaga publicznego adresu IP ani otwartych portów przychodzących.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Jak działa blokada sprzętowa (Hardware Fingerprint Lock)?"
                      answer={
                        <p>
                          Podczas pierwszego uruchomienia agent rejestruje unikalny hash sprzętowy powiązany z UUID GPU i procesora. Zapobiega to sytuacji, w której ktoś próbuje sklonować Twój prywatny klucz lub kontener i uruchomić drugi węzeł pod tym samym identyfikatorem.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Czy mogę uruchomić węzeł na karcie RTX 4090 lub 3090 (24GB VRAM)?"
                      answer={
                        <p>
                          Tak, ale karta 24GB działa w trybie <i>Community Tier</i>. Wymaga zmniejszenia bufora kontekstu w konfiguracji do <code className="rounded bg-bg-tertiary px-1">VLLM_MAX_MODEL_LEN=131072</code> oraz <code className="rounded bg-bg-tertiary px-1">VLLM_GPU_MEMORY_UTILIZATION=0.80</code>, aby uniknąć błędów Out Of Memory (OOM).
                        </p>
                      }
                    />
                    <FaqItem
                      question="Co się stanie, jeśli wyłączę komputer lub stracę połączenie internetowe?"
                      answer={
                        <p>
                          Bramka SeedInfer po prostu przestanie kierować ruch do Twojego węzła. Nie ma żadnych kar finansowych (slashingu). Wynagrodzenie retencyjne naliczane jest za każdą pełną godzinę dostępności z zachowaniem uptime &ge;50%.
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
                          Integrup z siecią SeedInfer w kilka sekund. API jest w 100% zgodne ze specyfikacją OpenAI oraz OpenRouter v2.4. Wystarczy podmienić <code className="rounded bg-bg-tertiary px-1">base_url</code> w standardowym pakiecie <code className="rounded bg-bg-tertiary px-1">openai</code>.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href="#cli-quickstart" className="inline-flex items-center gap-1 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover">
                            <Code2 className="h-3.5 w-3.5" /> API Quickstart ↓
                          </a>
                          <a href="#cli-models" className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover">
                            Modele & Cennik ↓
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
                            <span className="text-text-tertiary">Endpoint API</span>
                            <span className="font-semibold text-accent-brand">https://seedinfer.com/v1</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Format Zapytań</span>
                            <span className="font-semibold text-text-primary">OpenAI / OpenRouter JSON</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Streaming (SSE)</span>
                            <span className="font-semibold text-accent-green">Wspierane (stream: true)</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-bg-tertiary px-2.5 py-2">
                            <span className="text-text-tertiary">Prywatność Danych</span>
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
                      <Code2 className="h-4 w-4 text-accent-brand" /> Przykłady Kodowe (Python, Node.js, cURL)
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
                      <Cpu className="h-4 w-4 text-accent-brand" /> Dostępne Modele i Stawki API
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto rounded-xl border border-border-dim">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                          <tr>
                            <th className="px-3 py-2">Identyfikator Modelu</th>
                            <th className="px-3 py-2">Kontekst</th>
                            <th className="px-3 py-2">Cena Input / 1M</th>
                            <th className="px-3 py-2">Cena Output / 1M</th>
                            <th className="px-3 py-2">Specjalizacja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dim text-text-secondary">
                          <tr className="bg-accent-brand/5 font-medium text-text-primary">
                            <td className="px-3 py-2 flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] bg-accent-brand/10 text-accent-brand">Rekomendowany</Badge>
                              seedinfer/nemotron-lightning-1m
                            </td>
                            <td className="px-3 py-2">1,000,000 tokenów</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.02</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.10</td>
                            <td className="px-3 py-2">Długi kontekst, analiza dokumentów, kodowanie</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium">seedinfer/gemma-4-26b</td>
                            <td className="px-3 py-2">256,000 tokenów</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.03</td>
                            <td className="px-3 py-2 text-accent-green font-semibold">$0.30</td>
                            <td className="px-3 py-2">Szybkie rozumowanie, zadania wielojęzyczne</td>
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
                      <HelpCircle className="h-4 w-4 text-accent-brand" /> Client FAQ — Najczęściej Zadawane Pytania
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FaqItem
                      question="Czy moje dane (prompty i odpowiedzi) są zapisywane na dyskach węzłów?"
                      answer={
                        <p>
                          <strong>Nie.</strong> Architektura SeedInfer przestrzega zasady <i>Zero-Data Logging</i>. Prompty są przetwarzane wyłącznie w pamięci ulotnej RAM/VRAM karty graficznej. Żaden węzeł nie posiada uprawnień ani możliwości zapisywania treści zapytań na dysku.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Czy SeedInfer współpracuje z narzędziami takimi jak LangChain, AutoGen lub OpenCode?"
                      answer={
                        <p>
                          Tak! Ponieważ API używa standardowego protokołu OpenAI Chat Completions, wystarczy ustawić zmienną środowiskową <code className="rounded bg-bg-tertiary px-1">OPENAI_BASE_URL=https://seedinfer.com/v1</code> oraz podać dowolny klucz API w klauzulach konfiguracji.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Jak routing ewaluuje opóźnienia (latency) między dostawcami?"
                      answer={
                        <p>
                          Bramka SeedInfer używa algorytmu <strong>EWMA (Exponentially Weighted Moving Average)</strong> do ciągłego monitorowania czasu odpowiedzi (Time to First Token - TTFT) oraz przepustowości aktywnych węzłów. Zapytania są dynamicznie kierowane do najbliższego i najbardziej optymalnego dostawcy.
                        </p>
                      }
                    />
                    <FaqItem
                      question="Skąd mam wziąć Klucz API (API Key)?"
                      answer={
                        <p>
                          W obecnej fazie testów dostępny jest demonstracyjny publiczny klucz <code className="rounded bg-bg-tertiary px-1">sk-seedinfer-demo</code>. Możesz również wygenerować własny klucz w konsoli deweloperskiej w zakładce <Link href="/api-console" className="text-accent-brand underline">API Console</Link>.
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

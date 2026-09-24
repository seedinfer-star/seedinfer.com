"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Zap,
  Activity,
  Cpu,
  HardDrive,
  Coins,
  CreditCard,
  CheckCircle2,
  Server,
  RefreshCw,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  Terminal,
  LogOut,
  Wallet,
  Globe,
  Radio,
  FileCode2,
  AlertCircle,
  ExternalLink,
} from "lucide-react"

// Generate cryptographic-looking mock keypair
function generateKeypair() {
  const chars = "abcdef0123456789"
  let pub = "pk_node_"
  let priv = "sk_node_"
  for (let i = 0; i < 32; i++) {
    pub += chars.charAt(Math.floor(Math.random() * chars.length))
    priv += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return { publicKey: pub, privateKey: priv }
}

const DEMO_KEYPAIR = {
  publicKey: "pk_node_7f8a92b3c4d5e6f7a8b9c0d1e2f3a4b5",
  privateKey: "sk_node_99a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4",
}

export default function PortalContent() {
  const [keypair, setKeypair] = useState<{ publicKey: string; privateKey: string } | null>(null)
  const [pubInput, setPubInput] = useState("")
  const [privInput, setPrivInput] = useState("")
  const [showPriv, setShowPriv] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Wallet state
  const [evmWallet, setEvmWallet] = useState("0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786")
  const [solWallet, setSolWallet] = useState("")
  const [preferredAsset, setPreferredAsset] = useState("USDC (Base Network)")
  const [minPayout, setMinPayout] = useState("10.00")
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Copy helper state
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Telemetry simulation state
  const [telemetry, setTelemetry] = useState({
    gpuLoad: 78,
    vramUsed: 28.4,
    vramTotal: 32.0,
    tempGpu: 62,
    tempMem: 69,
    powerW: 345,
    powerTdp: 450,
    tokPerSec: 142.5,
    prefillMs: 14,
    activeStreams: 12,
    totalTokensToday: 4289100,
    retainerAccrued: 12.40,
    tokenProfitAccrued: 136.10,
    uptimePercent: 99.94,
  })

  // Load stored credentials on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("seedinfer_provider_keypair")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.publicKey && parsed.privateKey) {
          setKeypair(parsed)
        }
      }
      const storedWallet = localStorage.getItem("seedinfer_provider_wallet")
      if (storedWallet) {
        const parsedW = JSON.parse(storedWallet)
        if (parsedW.evmWallet) setEvmWallet(parsedW.evmWallet)
        if (parsedW.solWallet) setSolWallet(parsedW.solWallet)
        if (parsedW.preferredAsset) setPreferredAsset(parsedW.preferredAsset)
        if (parsedW.minPayout) setMinPayout(parsedW.minPayout)
      }
    } catch {}
  }, [])

  // Simulate live telemetry updates
  useEffect(() => {
    if (!keypair) return
    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const loadDiff = Math.floor(Math.random() * 9) - 4
        const newLoad = Math.min(98, Math.max(50, prev.gpuLoad + loadDiff))
        const tokDiff = Math.floor(Math.random() * 30) - 15
        const newTok = Math.min(185, Math.max(110, prev.tokPerSec + tokDiff / 10))
        return {
          ...prev,
          gpuLoad: newLoad,
          tokPerSec: Number(newTok.toFixed(1)),
          powerW: Math.min(420, Math.max(290, Math.round(300 + newLoad * 0.8))),
          tempGpu: Math.min(75, Math.max(55, Math.round(55 + newLoad * 0.12))),
          totalTokensToday: prev.totalTokensToday + Math.round(newTok * 3),
          tokenProfitAccrued: Number((prev.tokenProfitAccrued + 0.00015).toFixed(4)),
        }
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [keypair])

  const handleLogin = (pub: string, priv: string) => {
    setLoginError(null)
    if (!pub.trim() || !priv.trim()) {
      setLoginError("Please enter both Public Key and Private Key.")
      return
    }
    if (!pub.startsWith("pk_") && !pub.startsWith("0x")) {
      setLoginError("Invalid Public Key format. Must start with pk_ or 0x.")
      return
    }
    const pair = { publicKey: pub.trim(), privateKey: priv.trim() }
    setKeypair(pair)
    try {
      localStorage.setItem("seedinfer_provider_keypair", JSON.stringify(pair))
    } catch {}
  }

  const handleLogout = () => {
    setKeypair(null)
    setPubInput("")
    setPrivInput("")
    try {
      localStorage.removeItem("seedinfer_provider_keypair")
    } catch {}
  }

  const handleGenerate = () => {
    const pair = generateKeypair()
    setPubInput(pair.publicKey)
    setPrivInput(pair.privateKey)
    setShowPriv(true)
  }

  const handleDemoLogin = () => {
    setPubInput(DEMO_KEYPAIR.publicKey)
    setPrivInput(DEMO_KEYPAIR.privateKey)
    handleLogin(DEMO_KEYPAIR.publicKey, DEMO_KEYPAIR.privateKey)
  }

  const handleSaveWallet = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      localStorage.setItem(
        "seedinfer_provider_wallet",
        JSON.stringify({ evmWallet, solWallet, preferredAsset, minPayout })
      )
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
    } catch {}
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(label)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {}
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-[13px] font-semibold tracking-tight text-text-primary">
              <KeyRound className="h-4 w-4 text-accent-brand" /> Provider Portal · Public/Private Key Auth
            </h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              Node Key Authentication · Real-Time Telemetry · $0.40/day Retainer + 99% Net Profit Share · Crypto Payouts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {keypair ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="h-7 text-xs font-mono text-text-secondary hover:text-text-primary"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Disconnect Node
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDemoLogin}
                className="h-7 text-xs font-mono bg-accent-brand/10 text-accent-brand hover:bg-accent-brand/20 border border-accent-brand/30"
              >
                <Zap className="mr-1.5 h-3.5 w-3.5" /> Demo Node Login
              </Button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary p-4 sm:p-6">
          <div className="mx-auto max-w-[1400px] space-y-6">

            {/* UNAUTHENTICATED: LOGIN VIEW */}
            {!keypair ? (
              <div className="mx-auto max-w-2xl space-y-6 py-6">
                <Card className="border-border-dim bg-bg-secondary">
                  <CardHeader className="border-b border-border-dim pb-4">
                    <div className="flex items-center gap-2 text-accent-brand">
                      <ShieldCheck className="h-5 w-5" />
                      <CardTitle className="text-base font-semibold">Node Key Pair Authentication</CardTitle>
                    </div>
                    <CardDescription className="text-xs text-text-secondary">
                      Log in using your node cryptographic Public and Private keypair to inspect live node telemetry, accumulated electricity retainers, net profits, and configure crypto payout addresses.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    {loginError && (
                      <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 text-xs text-accent-amber font-mono">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {loginError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="font-mono text-xs text-text-secondary">Node Public Key (pk_node_... or EVM Address)</label>
                      <Input
                        type="text"
                        placeholder="pk_node_..."
                        value={pubInput}
                        onChange={(e) => setPubInput(e.target.value)}
                        className="font-mono text-xs bg-bg-tertiary border-border-dim"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-xs text-text-secondary">Node Private Key (sk_node_...)</label>
                        <button
                          type="button"
                          onClick={() => setShowPriv(!showPriv)}
                          className="flex items-center gap-1 font-mono text-[10px] text-text-tertiary hover:text-text-secondary"
                        >
                          {showPriv ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {showPriv ? "Hide" : "Show"}
                        </button>
                      </div>
                      <Input
                        type={showPriv ? "text" : "password"}
                        placeholder="sk_node_..."
                        value={privInput}
                        onChange={(e) => setPrivInput(e.target.value)}
                        className="font-mono text-xs bg-bg-tertiary border-border-dim"
                      />
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => handleLogin(pubInput, privInput)}
                        className="flex-1 bg-accent-brand hover:bg-accent-brand-hover text-white font-semibold text-xs"
                      >
                        <KeyRound className="mr-2 h-3.5 w-3.5" /> Authenticate & Open Portal
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleGenerate}
                        className="text-xs font-mono text-text-secondary border-border-dim hover:bg-bg-tertiary"
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Generate Keypair
                      </Button>
                    </div>

                    <div className="border-t border-border-dim pt-4 text-center">
                      <p className="font-mono text-[11px] text-text-tertiary">
                        Want to test the dashboard immediately without keys?
                      </p>
                      <button
                        type="button"
                        onClick={handleDemoLogin}
                        className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent-brand hover:underline"
                      >
                        <Zap className="h-3.5 w-3.5" /> Launch Interactive Demo Node (RTX 5090 Host) →
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Keypair Generator Box */}
                <Card className="border-border-dim bg-bg-tertiary/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                      How Node Key Pairs Work
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 font-mono text-xs text-text-tertiary leading-5">
                    <p>
                      • <strong className="text-text-primary">Public Key (pk_node_...)</strong>: Identifies your node in the SeedInfer gateway network, registered during <code className="rounded bg-bg-secondary px-1 text-accent-green">install.sh</code>.
                    </p>
                    <p>
                      • <strong className="text-text-primary">Private Key (sk_node_...)</strong>: Signs heartbeats, telemetry metrics, and authorizes changes to your Crypto Payout Address.
                    </p>
                    <p>
                      • <strong className="text-text-primary">Security</strong>: Your private key is stored locally in your browser session and host CLI daemon (`/opt/seedinfer/node.json`). Never share it publicly.
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (

              /* AUTHENTICATED: PROVIDER DASHBOARD */
              <div className="space-y-6">

                {/* Node Status Banner */}
                <Card className="border-border-dim bg-bg-secondary">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-green"></span>
                          </span>
                          <h2 className="text-base font-bold text-text-primary font-mono tracking-tight">
                            RTX 5090 NODE #01
                          </h2>
                          <Badge variant="outline" className="border-accent-green/30 bg-accent-green/10 text-accent-green font-mono text-[10px]">
                            ACTIVE · LOAD BALANCED
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
                          <span>Public Key:</span>
                          <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[11px] text-text-primary">
                            {keypair.publicKey}
                          </code>
                          <button
                            onClick={() => copyToClipboard(keypair.publicKey, "pk")}
                            className="text-text-tertiary hover:text-text-primary"
                            title="Copy Public Key"
                          >
                            {copiedKey === "pk" ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-text-secondary">
                        <div className="rounded-lg bg-bg-tertiary px-3 py-1.5 border border-border-dim">
                          <span className="text-text-tertiary">Hardware: </span>
                          <span className="font-semibold text-text-primary">NVIDIA RTX 5090 (32GB)</span>
                        </div>
                        <div className="rounded-lg bg-bg-tertiary px-3 py-1.5 border border-border-dim">
                          <span className="text-text-tertiary">Model: </span>
                          <span className="font-semibold text-accent-brand">gemma-4-26b-nvfp4</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Metric Summary Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                  <Card className="border-border-dim bg-bg-secondary p-4">
                    <div className="flex items-center justify-between text-text-tertiary text-xs">
                      <span>Total Earnings</span>
                      <Coins className="h-4 w-4 text-accent-green" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-accent-green">
                      ${(telemetry.retainerAccrued + telemetry.tokenProfitAccrued).toFixed(2)} USD
                    </div>
                    <p className="mt-1 text-[10px] text-text-tertiary">99% net profit + power pool</p>
                  </Card>

                  <Card className="border-border-dim bg-bg-secondary p-4">
                    <div className="flex items-center justify-between text-text-tertiary text-xs">
                      <span>Retainer Pool ($0.40/d)</span>
                      <Zap className="h-4 w-4 text-accent-amber" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-accent-amber">
                      ${telemetry.retainerAccrued.toFixed(2)} USD
                    </div>
                    <p className="mt-1 text-[10px] text-text-tertiary">$0.01667/hr accrued standby</p>
                  </Card>

                  <Card className="border-border-dim bg-bg-secondary p-4">
                    <div className="flex items-center justify-between text-text-tertiary text-xs">
                      <span>Tokens Processed</span>
                      <Activity className="h-4 w-4 text-accent-brand" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-text-primary">
                      {(telemetry.totalTokensToday / 1000000).toFixed(2)}M
                    </div>
                    <p className="mt-1 text-[10px] text-text-tertiary">{telemetry.tokPerSec} tok/s throughput</p>
                  </Card>

                  <Card className="border-border-dim bg-bg-secondary p-4">
                    <div className="flex items-center justify-between text-text-tertiary text-xs">
                      <span>Node Uptime</span>
                      <ShieldCheck className="h-4 w-4 text-accent-green" />
                    </div>
                    <div className="mt-2 text-xl font-bold text-text-primary">
                      {telemetry.uptimePercent}%
                    </div>
                    <p className="mt-1 text-[10px] text-accent-green">Health Score: 100/100</p>
                  </Card>
                </div>

                {/* Dashboard Tabs */}
                <Tabs defaultValue="telemetry" className="space-y-4">
                  <TabsList className="bg-bg-secondary border border-border-dim p-1 font-mono text-xs">
                    <TabsTrigger value="telemetry" className="data-[state=active]:bg-bg-tertiary">
                      <Activity className="mr-1.5 h-3.5 w-3.5" /> Telemetry & Hardware
                    </TabsTrigger>
                    <TabsTrigger value="earnings" className="data-[state=active]:bg-bg-tertiary">
                      <Coins className="mr-1.5 h-3.5 w-3.5" /> Earnings & Revenue
                    </TabsTrigger>
                    <TabsTrigger value="wallet" className="data-[state=active]:bg-bg-tertiary">
                      <Wallet className="mr-1.5 h-3.5 w-3.5" /> Crypto Payout Setup
                    </TabsTrigger>
                    <TabsTrigger value="keys" className="data-[state=active]:bg-bg-tertiary">
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Key Management
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB 1: TELEMETRY & HARDWARE */}
                  <TabsContent value="telemetry" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      
                      {/* GPU Core & Memory Gauges */}
                      <Card className="border-border-dim bg-bg-secondary">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-accent-brand" /> GPU Tensor Core & VRAM Telemetry
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 font-mono text-xs">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-text-secondary">
                              <span>NVFP4 Tensor Core Load</span>
                              <span className="font-semibold text-accent-brand">{telemetry.gpuLoad}%</span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
                              <div
                                className="h-full bg-accent-brand transition-all duration-500 rounded-full"
                                style={{ width: `${telemetry.gpuLoad}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-text-secondary">
                              <span>VRAM Memory Allocation</span>
                              <span className="font-semibold text-text-primary">
                                {telemetry.vramUsed} GB / {telemetry.vramTotal} GB ({((telemetry.vramUsed / telemetry.vramTotal) * 100).toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
                              <div
                                className="h-full bg-accent-green transition-all duration-500 rounded-full"
                                style={{ width: `${(telemetry.vramUsed / telemetry.vramTotal) * 100}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-text-tertiary">~22GB Gemma 4 NVFP4 + ~6.4GB FP8 KV Cache (1M Tokens)</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="rounded-lg bg-bg-tertiary p-2.5 border border-border-dim">
                              <span className="text-text-tertiary">Power Draw</span>
                              <div className="text-sm font-bold text-text-primary mt-0.5">
                                {telemetry.powerW}W / {telemetry.powerTdp}W
                              </div>
                            </div>
                            <div className="rounded-lg bg-bg-tertiary p-2.5 border border-border-dim">
                              <span className="text-text-tertiary">GPU / Memory Temp</span>
                              <div className="text-sm font-bold text-text-primary mt-0.5">
                                {telemetry.tempGpu}°C / {telemetry.tempMem}°C
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Performance & Routing Latency */}
                      <Card className="border-border-dim bg-bg-secondary">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Radio className="h-4 w-4 text-accent-green" /> Inference Throughput & Latency
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 font-mono text-xs">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-bg-tertiary p-3 border border-border-dim">
                              <span className="text-text-tertiary">Generation Speed</span>
                              <div className="text-lg font-bold text-accent-green mt-1">
                                {telemetry.tokPerSec} tok/s
                              </div>
                              <span className="text-[10px] text-text-tertiary">Marlin FP8 Kernel</span>
                            </div>

                            <div className="rounded-lg bg-bg-tertiary p-3 border border-border-dim">
                              <span className="text-text-tertiary">Prefill Latency</span>
                              <div className="text-lg font-bold text-text-primary mt-1">
                                {telemetry.prefillMs} ms
                              </div>
                              <span className="text-[10px] text-text-tertiary">FlashInfer Chunked</span>
                            </div>
                          </div>

                          <div className="rounded-lg bg-bg-tertiary p-3 border border-border-dim space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-text-secondary">Active Streams:</span>
                              <span className="font-bold text-accent-brand">{telemetry.activeStreams} concurrent</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-text-secondary">Gateway Router Ping:</span>
                              <span className="font-bold text-accent-green">8.2 ms</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-text-secondary">Load Balance Share:</span>
                              <span className="font-bold text-text-primary">Equal distribution (No Spec Rat Race)</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Live Request Stream Log */}
                    <Card className="border-border-dim bg-bg-secondary">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 font-mono">
                          <Terminal className="h-4 w-4 text-accent-amber" /> Live Host Telemetry Feed & Inference Audit
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-lg bg-black/80 p-3 font-mono text-[11px] leading-5 text-accent-green space-y-1 overflow-x-auto max-h-48 overflow-y-auto border border-border-dim">
                          <p>[SYSTEM] Heartbeat ACK · Gateway router ping 8.2ms · Uptime 99.94%</p>
                          <p>[TELEMETRY] RTX 5090 · Temp: {telemetry.tempGpu}°C · Power: {telemetry.powerW}W · Fan: 55%</p>
                          <p>[ROUTER] Allocated job #req_981a2 · Model gemma-4-26b-a4b-nvfp4 · 512 input tokens</p>
                          <p>[EXEC] Streamed 148 tokens @ {telemetry.tokPerSec} tok/s · Payout accrued: +$0.00003 USD</p>
                          <p>[STIPEND] Hourly electricity retainer tick (+ $0.01667 USD accrued to node pool)</p>
                          <p>[CHECK] Verified hardware consensus passed · FP8 KV Cache status OK</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB 2: EARNINGS & REVENUE */}
                  <TabsContent value="earnings" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                      <Card className="border-border-dim bg-bg-secondary p-4">
                        <span className="text-xs text-text-tertiary">Accrued Power Retainer</span>
                        <div className="text-2xl font-bold text-accent-amber mt-2">
                          ${telemetry.retainerAccrued.toFixed(2)} USD
                        </div>
                        <p className="mt-1 text-[10px] text-text-secondary">$0.40 USD/day guaranteed active node retainer</p>
                      </Card>

                      <Card className="border-border-dim bg-bg-secondary p-4">
                        <span className="text-xs text-text-tertiary">Token Execution Net Share (99%)</span>
                        <div className="text-2xl font-bold text-accent-green mt-2">
                          ${telemetry.tokenProfitAccrued.toFixed(2)} USD
                        </div>
                        <p className="mt-1 text-[10px] text-text-secondary">99% share of net protocol inference revenue</p>
                      </Card>

                      <Card className="border-border-dim bg-bg-secondary p-4">
                        <span className="text-xs text-text-tertiary">Next Payout Cycle</span>
                        <div className="text-2xl font-bold text-text-primary mt-2">
                          3 Days
                        </div>
                        <p className="mt-1 text-[10px] text-accent-green">Automated on-chain payout to registered wallet</p>
                      </Card>
                    </div>

                    <Card className="border-border-dim bg-bg-secondary">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Coins className="h-4 w-4 text-accent-green" /> Waterfall Settlement Engine Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 font-mono text-xs text-text-secondary leading-5">
                        <div className="rounded-lg bg-bg-tertiary p-3 border border-border-dim space-y-1.5">
                          <div className="font-semibold text-text-primary text-xs">1. Standby Electricity Retainer ($0.40/day)</div>
                          <p className="text-[11px] text-text-tertiary">
                            Accrues at $0.01667/hr for every active hour on standby. Ensures every node host covers power costs regardless of instantaneous traffic spikes.
                          </p>
                        </div>

                        <div className="rounded-lg bg-bg-tertiary p-3 border border-border-dim space-y-1.5">
                          <div className="font-semibold text-text-primary text-xs">2. 99% Net Profit Share</div>
                          <p className="text-[11px] text-text-tertiary">
                            After deducting network retainers, 99% of remaining net profit is distributed evenly among active nodes via load-balanced routing.
                          </p>
                        </div>

                        <div className="rounded-lg bg-bg-tertiary p-3 border border-border-dim space-y-1.5">
                          <div className="font-semibold text-text-primary text-xs">3. 1% Protocol Development Fee</div>
                          <p className="text-[11px] text-text-tertiary">
                            1% is allocated to protocol maintenance, open-source model optimization, and gateway infrastructure.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB 3: CRYPTO PAYOUT WALLET SETUP */}
                  <TabsContent value="wallet" className="space-y-4">
                    <Card className="border-border-dim bg-bg-secondary">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-accent-brand" /> Configure Crypto Payout Wallet Addresses
                        </CardTitle>
                        <CardDescription className="text-xs text-text-secondary font-mono">
                          Specify your on-chain EVM and Solana wallet addresses for automated monthly retainer and net profit payouts. Updates are signed using your Node Private Key (<code className="text-text-primary">{keypair.privateKey.substring(0, 10)}...</code>).
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSaveWallet} className="space-y-4 font-mono text-xs">
                          <div className="flex items-start gap-2.5 rounded-lg border border-accent-brand/40 bg-accent-brand/10 p-3 text-xs text-text-primary font-mono">
                            <AlertCircle className="h-4 w-4 text-accent-brand shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <span className="font-bold text-accent-brand">Mandatory Payout Requirement:</span>
                              <p className="text-[11px] text-text-secondary leading-4">
                                In order for automated node payouts ($0.40/day retainer + 99% profit share) to be processed, you <strong className="text-text-primary">MUST provide an EVM crypto wallet address on the Base Chain (Base Network)</strong> below.
                              </p>
                            </div>
                          </div>

                          {savedSuccess && (
                            <div className="flex items-center gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 p-3 text-xs text-accent-green">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              Payout wallets updated successfully and signed with Node Private Key!
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <label className="text-text-secondary font-semibold flex items-center justify-between">
                              <span>Base Chain EVM Wallet Address (Required for Payouts)</span>
                              <Badge variant="outline" className="text-[10px] border-accent-brand/40 text-accent-brand bg-accent-brand/10">Base Network 0x...</Badge>
                            </label>
                            <Input
                              type="text"
                              value={evmWallet}
                              onChange={(e) => setEvmWallet(e.target.value)}
                              className="font-mono text-xs bg-bg-tertiary border-border-dim"
                              placeholder="0x... (Base Chain Wallet Address)"
                            />
                            <p className="text-[10px] text-accent-green font-mono">✓ Retainers & 99% Net Profits are automatically transferred to this Base Chain address</p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-text-secondary font-semibold">Secondary / Backup Wallet Address (Optional)</label>
                            <Input
                              type="text"
                              value={solWallet}
                              onChange={(e) => setSolWallet(e.target.value)}
                              className="font-mono text-xs bg-bg-tertiary border-border-dim"
                              placeholder="Optional Solana or EVM backup address..."
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-text-secondary font-semibold">Preferred Settlement Token</label>
                              <select
                                value={preferredAsset}
                                onChange={(e) => setPreferredAsset(e.target.value)}
                                className="w-full h-9 rounded-md border border-border-dim bg-bg-tertiary px-3 text-xs text-text-primary font-mono"
                              >
                                <option value="USDC (Base Network)">USDC (Base Network · Primary Payout)</option>
                                <option value="ETH (Base Network)">ETH (Base Network)</option>
                                <option value="USDC (HyperEVM)">USDC (HyperEVM)</option>
                                <option value="USDT (Arbitrum)">USDT (Arbitrum)</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-text-secondary font-semibold">Minimum Payout Threshold (USD)</label>
                              <Input
                                type="text"
                                value={minPayout}
                                onChange={(e) => setMinPayout(e.target.value)}
                                className="font-mono text-xs bg-bg-tertiary border-border-dim"
                              />
                            </div>
                          </div>

                          <Button type="submit" className="bg-accent-brand hover:bg-accent-brand-hover text-white text-xs font-semibold">
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Save & Sign Payout Configuration
                          </Button>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Past Payouts Table */}
                    <Card className="border-border-dim bg-bg-secondary">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs uppercase tracking-wider font-mono text-text-tertiary">
                          Recent On-Chain Settlement Payouts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto font-mono text-xs">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-border-dim text-text-tertiary text-[11px]">
                                <th className="pb-2 font-normal">Date</th>
                                <th className="pb-2 font-normal">Amount</th>
                                <th className="pb-2 font-normal">Asset / Chain</th>
                                <th className="pb-2 font-normal">Status</th>
                                <th className="pb-2 font-normal">Tx Hash</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dim text-text-secondary">
                              <tr>
                                <td className="py-2.5">2026-08-01</td>
                                <td className="font-bold text-accent-green">$142.80 USD</td>
                                <td>USDC (HyperEVM)</td>
                                <td><Badge variant="outline" className="text-[10px] bg-accent-green/10 text-accent-green border-accent-green/30">PAID</Badge></td>
                                <td>
                                  <a href="https://hyperliquid.cloud/explorer/tx/0x918a...2b4f" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline inline-flex items-center gap-1">
                                    0x918a...2b4f <ExternalLink className="h-3 w-3" />
                                  </a>
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2.5">2026-07-01</td>
                                <td className="font-bold text-accent-green">$128.50 USD</td>
                                <td>USDC (HyperEVM)</td>
                                <td><Badge variant="outline" className="text-[10px] bg-accent-green/10 text-accent-green border-accent-green/30">PAID</Badge></td>
                                <td>
                                  <a href="https://hyperliquid.cloud/explorer/tx/0x442c...88a1" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline inline-flex items-center gap-1">
                                    0x442c...88a1 <ExternalLink className="h-3 w-3" />
                                  </a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB 4: KEY MANAGEMENT */}
                  <TabsContent value="keys" className="space-y-4">
                    <Card className="border-border-dim bg-bg-secondary">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-accent-amber" /> Active Node Cryptographic Keys
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 font-mono text-xs">
                        <div className="space-y-1.5">
                          <label className="text-text-tertiary">Node Public Key</label>
                          <div className="flex items-center gap-2">
                            <Input readOnly value={keypair.publicKey} className="font-mono text-xs bg-bg-tertiary border-border-dim" />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(keypair.publicKey, "pk_tab")}
                              className="h-9 px-3 text-xs"
                            >
                              {copiedKey === "pk_tab" ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <label className="text-text-tertiary">Node Private Key</label>
                            <button
                              type="button"
                              onClick={() => setShowPriv(!showPriv)}
                              className="text-[10px] text-text-tertiary hover:text-text-secondary"
                            >
                              {showPriv ? "Hide" : "Show"}
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              type={showPriv ? "text" : "password"}
                              value={keypair.privateKey}
                              className="font-mono text-xs bg-bg-tertiary border-border-dim"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(keypair.privateKey, "sk_tab")}
                              className="h-9 px-3 text-xs"
                            >
                              {copiedKey === "sk_tab" ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-lg bg-bg-tertiary p-3 border border-border-dim space-y-2">
                          <div className="font-semibold text-text-primary text-xs">CLI Host Integration</div>
                          <p className="text-[11px] text-text-tertiary leading-4">
                            To bind your Linux host daemon to this authenticated keypair, run on your GPU server:
                          </p>
                          <div className="rounded bg-black/80 p-2 text-accent-green text-[11px]">
                            curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey {keypair.publicKey}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}

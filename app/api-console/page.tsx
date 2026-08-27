"use client"
import { useState } from "react"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Code2, ExternalLink, Copy, Check, Play, Terminal, Zap, Shield, Server, ArrowRight, Layers, Activity } from "lucide-react"

const OPENROUTER_SNIPPET = `// OpenRouter Custom Provider Configuration
{
  "provider": "SeedInfer Network",
  "base_url": "https://seedinfer.com/api/v1",
  "api_key": "YOUR_SEEDINFER_API_KEY",
  "models": ["seedinfer/nemotron-lightning-1m", "gpt-oss-20b"]
}`

const CURL_EXAMPLE = `curl -X POST https://seedinfer.com/api/v1/chat/completions \\
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "HTTP-Referer: https://seedinfer.com" \\
  -H "X-Title: SeedInfer OpenRouter Client" \\
  -d '{
    "model": "seedinfer/nemotron-lightning-1m",
    "messages": [
      {"role": "user", "content": "Explain private decentralized inference on Apple Silicon and RTX 5090 in one sentence."}
    ],
    "stream": false,
    "max_tokens": 256
  }'`

const PYTHON_EXAMPLE = `from openai import OpenAI

client = OpenAI(
    base_url="https://seedinfer.com/api/v1",
    api_key="your-seedinfer-key-or-any-token",
)

response = client.chat.completions.create(
    model="seedinfer/nemotron-lightning-1m",
    messages=[{"role": "user", "content": "Hello SeedInfer network"}],
    stream=True,
)

for chunk in response:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)`

const JS_EXAMPLE = `import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://seedinfer.com/api/v1",
  apiKey: "your-seedinfer-key-or-any-token",
});

const completion = await openai.chat.completions.create({
  model: "seedinfer/nemotron-lightning-1m",
  messages: [{ role: "user", content: "Hello SeedInfer network" }],
});

console.log(completion.choices[0].message.content);`

const TAILNET_EXAMPLE = `curl -X POST https://tailnet.seedinfer.com/v1/chat/completions \\
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "seedinfer/nemotron-lightning-1m",
    "messages": [{"role": "user", "content": "Hello via Direct Tailnet"}]
  }'`

export default function ApiConsolePage() {
  const [copied, setCopied] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"curl" | "openrouter" | "python" | "js" | "tailnet">("openrouter")
  const [promptText, setPromptText] = useState("Explain private decentralized inference on RTX 5090 and Apple Silicon in one sentence.")
  const [isStream, setIsStream] = useState(false)
  const [selectedModel, setSelectedModel] = useState("seedinfer/nemotron-lightning-1m")
  
  const [responseOutput, setResponseOutput] = useState<string>("Click 'Send Live Request' to execute a real query against the SeedInfer network.")
  const [metaHeaders, setMetaHeaders] = useState<{
    status?: number
    statusText?: string
    ttft?: string
    provider?: string
    upstream?: string
    latencyMs?: number
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  const executeLiveRequest = async () => {
    setLoading(true)
    setResponseOutput("Connecting to /api/v1/chat/completions ...")
    setMetaHeaders(null)
    const startTime = Date.now()

    const payload = {
      model: selectedModel,
      messages: [{ role: "user", content: promptText }],
      stream: isStream,
      max_tokens: 256,
    }

    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "SeedInfer Interactive API Playground",
          "HTTP-Referer": "https://seedinfer.com/api-console",
        },
        body: JSON.stringify(payload),
      })

      const latencyMs = Date.now() - startTime
      const headersInfo = {
        status: res.status,
        statusText: res.statusText,
        ttft: res.headers.get("x-seedinfer-ttft") || undefined,
        provider: res.headers.get("x-seedinfer-provider") || undefined,
        upstream: res.headers.get("x-seedinfer-upstream") || undefined,
        latencyMs,
      }
      setMetaHeaders(headersInfo)

      if (isStream && res.body) {
        setResponseOutput("")
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setResponseOutput(accumulated)
        }
      } else {
        const text = await res.text()
        try {
          const parsed = JSON.parse(text)
          setResponseOutput(JSON.stringify(parsed, null, 2))
        } catch {
          setResponseOutput(text)
        }
      }
    } catch (err: any) {
      setResponseOutput(`Network Error: ${err?.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const getActiveCode = () => {
    switch (activeTab) {
      case "openrouter":
        return OPENROUTER_SNIPPET
      case "curl":
        return CURL_EXAMPLE
      case "python":
        return PYTHON_EXAMPLE
      case "js":
        return JS_EXAMPLE
      case "tailnet":
        return TAILNET_EXAMPLE
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">API Console &amp; OpenRouter Hub</h1>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-400">
              Live Production
            </Badge>
          </div>
          <a
            href="https://docs.seedinfer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            docs.seedinfer.com <ExternalLink className="h-3 w-3" />
          </a>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
            
            {/* OpenRouter Banner */}
            <Card className="border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-bg-secondary to-bg-secondary">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <h2 className="text-sm font-semibold text-text-primary">OpenRouter &amp; OpenAI SDK Integration Ready</h2>
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">
                        OpenAI-Compatible Base URL
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary">
                      Plug SeedInfer directly into OpenRouter, LangChain, Vercel AI SDK, or any OpenAI-compatible client.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded border border-border-dim bg-bg-tertiary px-2 py-1 font-mono text-xs text-emerald-400 select-all">
                      https://seedinfer.com/api/v1
                    </code>
                    <button
                      onClick={() => copy("https://seedinfer.com/api/v1", "baseurl")}
                      className="inline-flex items-center gap-1 rounded-md border border-border-dim bg-bg-tertiary px-2.5 py-1 font-mono text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
                    >
                      {copied === "baseurl" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === "baseurl" ? "Copied Base URL" : "Copy Base URL"}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Playground Card */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3 border-b border-border-dim/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-accent-brand" />
                    <CardTitle className="text-sm font-semibold text-text-primary">Live API Playground (Real Network Execution)</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="rounded-lg border border-border-dim bg-bg-tertiary px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-brand"
                    >
                      <option value="seedinfer/nemotron-lightning-1m">seedinfer/nemotron-lightning-1m</option>
                      <option value="gpt-oss-20b">gpt-oss-20b</option>
                    </select>

                    <label className="flex items-center gap-1.5 rounded-lg border border-border-dim bg-bg-tertiary px-2.5 py-1.5 text-xs text-text-secondary cursor-pointer hover:bg-bg-elevated select-none">
                      <input
                        type="checkbox"
                        checked={isStream}
                        onChange={(e) => setIsStream(e.target.checked)}
                        className="rounded border-border-dim text-accent-brand focus:ring-0"
                      />
                      <span className="font-mono text-[11px]">Stream SSE</span>
                    </label>

                    <Button size="sm" onClick={executeLiveRequest} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                      <Play className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                      {loading ? "Executing…" : "Send Live Request"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">User Message Prompt</span>
                      <Badge variant="outline" className="font-mono text-[10px]">POST /api/v1/chat/completions</Badge>
                    </div>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="Type your inference prompt here..."
                      className="h-[220px] w-full rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Live Network Output</span>
                      <button
                        onClick={() => copy(responseOutput, "output")}
                        className="inline-flex items-center gap-1 rounded-md border border-border-dim bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary hover:bg-bg-elevated transition-colors"
                      >
                        {copied === "output" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copied === "output" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="h-[220px] overflow-auto rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-[11px] leading-relaxed text-text-secondary select-text whitespace-pre-wrap">
                      {responseOutput}
                    </pre>
                  </div>
                </div>

                {/* Response Metadata Bar */}
                {metaHeaders && (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-dim bg-bg-tertiary/50 p-3 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-tertiary">Status:</span>
                      <Badge variant={metaHeaders.status === 200 ? "success" : "outline"} className="font-mono text-[11px]">
                        {metaHeaders.status} {metaHeaders.statusText || ""}
                      </Badge>
                    </div>

                    {metaHeaders.latencyMs !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-tertiary">Latency:</span>
                        <span className="text-emerald-400 font-semibold">{metaHeaders.latencyMs}ms</span>
                      </div>
                    )}

                    {metaHeaders.ttft && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-tertiary">TTFT:</span>
                        <span className="text-sky-400 font-semibold">{metaHeaders.ttft}ms</span>
                      </div>
                    )}

                    {metaHeaders.provider && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-tertiary">Routed Node:</span>
                        <span className="text-amber-400">{metaHeaders.provider}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Integration Snippets Code Tabs */}
            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-2 border-b border-border-dim/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-emerald-400" />
                    <CardTitle className="text-xs font-mono uppercase tracking-wide text-text-primary">
                      Integration Code Snippets
                    </CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-bg-tertiary p-1 border border-border-dim">
                    <button
                      onClick={() => setActiveTab("openrouter")}
                      className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                        activeTab === "openrouter" ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-text-tertiary hover:text-text-secondary"
                      }`}
                    >
                      OpenRouter
                    </button>
                    <button
                      onClick={() => setActiveTab("curl")}
                      className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                        activeTab === "curl" ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-text-tertiary hover:text-text-secondary"
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      onClick={() => setActiveTab("python")}
                      className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                        activeTab === "python" ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-text-tertiary hover:text-text-secondary"
                      }`}
                    >
                      Python OpenAI
                    </button>
                    <button
                      onClick={() => setActiveTab("js")}
                      className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                        activeTab === "js" ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-text-tertiary hover:text-text-secondary"
                      }`}
                    >
                      Node.js OpenAI
                    </button>
                    <button
                      onClick={() => setActiveTab("tailnet")}
                      className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                        activeTab === "tailnet" ? "bg-emerald-500/20 text-emerald-400 font-semibold" : "text-text-tertiary hover:text-text-secondary"
                      }`}
                    >
                      Tailnet Direct P2P
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="relative">
                  <button
                    onClick={() => copy(getActiveCode(), activeTab)}
                    className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-border-dim bg-bg-tertiary px-2.5 py-1 font-mono text-[11px] text-text-secondary hover:bg-bg-elevated transition-colors z-10"
                  >
                    {copied === activeTab ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === activeTab ? "Copied Code" : "Copy Code"}
                  </button>
                  <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-primary p-4 font-mono text-xs leading-relaxed text-text-secondary">
                    {getActiveCode()}
                  </pre>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono text-text-tertiary">
                  <Badge variant="success" className="font-mono text-[10px]">Model: seedinfer/nemotron-lightning-1m</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">Pricing: $0.02 / $0.05 per 1M</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">Context: 1M tokens</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">SSE Streaming: Supported</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="border-t border-border-dim pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px] text-text-tertiary">
              <div>
                SeedInfer Network · Production API Console &amp; OpenRouter Endpoint Gateway
              </div>
              <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">
                Documentation &amp; OpenRouter Guide
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}


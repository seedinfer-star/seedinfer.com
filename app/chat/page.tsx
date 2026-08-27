"use client"
import { useState, useRef } from "react"
import Sidebar from "@/components/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, ExternalLink, Send, Copy, Check, Sparkles, Cpu } from "lucide-react"

type Msg = { role: "user" | "assistant"; content: string }

const CURL = `curl https://api.seedinfer.com/v1/chat/completions \\
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "seedinfer/nemotron-lightning-1m",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'`

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Welcome to SeedInfer Chat — private inference on verified Macs. Ask anything. Model: seedinfer/nemotron-lightning-1m (1M context, 2M KV)." },
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const user: Msg = { role: "user", content: text }
    setMessages((m) => [...m, user])
    setInput("")
    setSending(true)
    // mock streamed assistant
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            `Mock reply for: "${text}"\n\nThis is a stub — connect live via POST /v1/chat/completions on docs.seedinfer.com. SeedInfer routes to the dedicated edge at api.seedinfer.com. Model: seedinfer/nemotron-lightning-1m · $0.02/$0.05 per 1M · 1M ctx · cache 60s free.`,
        },
      ])
      setSending(false)
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50)
    }, 700)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CURL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Chat</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">
              Private inference playground · seedinfer/nemotron-lightning-1m · OpenAI-compatible · docs.seedinfer.com
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="hidden sm:inline-flex font-mono text-[10px]">1M ctx · 2M KV</Badge>
            <a
              href="https://docs.seedinfer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              docs.seedinfer.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6 lg:flex-row">
            <div className="flex min-h-[540px] flex-1 flex-col rounded-xl border border-border-dim bg-bg-secondary shadow-sm">
              <div className="flex items-center justify-between border-b border-border-dim px-3 py-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent-brand" />
                  <span className="text-xs font-semibold text-text-primary">Playground</span>
                  <Badge variant="outline" className="font-mono text-[10px]">seedinfer/nemotron-lightning-1m</Badge>
                  <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px]">$0.02 / $0.05 · 1M</Badge>
                </div>
                <span className="hidden font-mono text-[10px] text-text-tertiary sm:inline">{messages.length} messages</span>
              </div>

              <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                        m.role === "user"
                          ? "bg-accent-brand text-white"
                          : "border border-border-dim bg-bg-primary text-text-primary"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div className={`mt-1 font-mono text-[10px] ${m.role === "user" ? "text-white/70" : "text-text-tertiary"}`}>{m.role === "user" ? "you" : "seedinfer · Nemotron"}</div>
                    </div>
                  </div>
                ))}
                {sending && <div className="font-mono text-xs text-text-tertiary">Seedinfer is thinking…</div>}
              </div>

              <div className="border-t border-border-dim p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    placeholder="Ask SeedInfer — Shift+Enter for newline, Enter to send…"
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-brand"
                  />
                  <Button onClick={send} disabled={!input.trim() || sending} className="h-[44px] shrink-0">
                    <Send className="mr-1.5 h-4 w-4" />
                    Send
                  </Button>
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-text-tertiary">
                  Stub — mock replies only. Live via <code className="rounded bg-bg-tertiary px-1">POST /v1/chat/completions</code> ·{" "}
                  <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">
                    docs.seedinfer.com
                  </a>{" "}
                  · Note: <code className="rounded bg-bg-tertiary px-1">/</code> currently shows Network stats; this Chat playground lives at{" "}
                  <code className="rounded bg-bg-tertiary px-1">/chat</code>.
                </p>
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[380px]">
              <Card className="border border-amber-500/20 bg-amber-500/10">
                <CardContent className="p-3 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-text-primary">Coming soon — proxy to docs.seedinfer.com</div>
                    <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                      Chat will proxy OpenAI-compatible{" "}
                      <code className="rounded bg-bg-tertiary px-1">POST /v1/chat/completions</code> to SeedInfer then SeedInfer edge. Auth via{" "}
                      <code className="rounded bg-bg-tertiary px-1">Bearer $SEEDINFER_API_KEY</code>.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border-dim bg-bg-secondary">
                <CardContent className="p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">curl example</span>
                    <button
                      onClick={copy}
                      className="inline-flex items-center gap-1 rounded-md border border-border-dim bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary hover:bg-bg-elevated"
                    >
                      {copied ? <Check className="h-3 w-3 text-accent-green" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-xl border border-border-dim bg-bg-primary p-3 font-mono text-[11px] leading-4 text-text-secondary">{CURL}</pre>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="success" className="font-mono text-[10px]">OpenAI compat</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">stream</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">cache 60s free</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border-dim bg-bg-secondary">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-text-primary">
                    <Cpu className="h-3.5 w-3.5 text-accent-brand" />
                    Model
                  </div>
                  <div className="rounded-lg border border-border-dim bg-bg-primary p-2 font-mono text-xs">
                    <div className="font-semibold text-text-primary">seedinfer/nemotron-lightning-1m</div>
                    <div className="text-text-secondary">Nemotron Lightning · 1M context · 2M KV · $0.02 / $0.05 per 1M</div>
                    <div className="mt-1 text-[11px] text-text-tertiary">Faza 0 active · Faza 1 (Qwen/Gemma) — soon</div>
                  </div>
                  <p className="font-mono text-[10px] text-text-tertiary"> Docs: <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">docs.seedinfer.com</a> · root <code className="rounded bg-bg-tertiary px-1">/</code> serves Network stats; Chat also at <code className="rounded bg-bg-tertiary px-1">/chat</code>.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

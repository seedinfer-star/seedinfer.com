"use client"
import { useState, useRef } from "react"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send, Copy, Check, Sparkles, Cpu, KeyRound } from "lucide-react"
import { LIVE_MODEL, API_BASE_URL, CACHE_POLICY, usd } from "@/lib/catalog"

type Msg = { role: "user" | "assistant"; content: string; error?: boolean }

const PRICE = `${usd(LIVE_MODEL.pricePer1M.input)} / ${usd(LIVE_MODEL.pricePer1M.output)} per 1M`

const CURL = `curl ${API_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${LIVE_MODEL.id}",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'`

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Welcome to the SeedInfer playground. Requests go to ${API_BASE_URL}/chat/completions with model ${LIVE_MODEL.id} (${LIVE_MODEL.contextLabel} context). Enter your API key and ask anything.`,
    },
  ])
  const [input, setInput] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollDown = () => setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50)

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const history = [...messages.filter((m, i) => i > 0 && !m.error), { role: "user" as const, content: text }]
    setMessages((m) => [...m, { role: "user", content: text }])
    setInput("")
    if (!apiKey.trim()) {
      setMessages((m) => [...m, { role: "assistant", content: "Please enter your SeedInfer API key above to send requests.", error: true }])
      scrollDown()
      return
    }
    setSending(true)
    try {
      const r = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: LIVE_MODEL.id,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: 512,
          stream: false,
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error?.message || `Request failed (HTTP ${r.status})`)
      const reply = j?.choices?.[0]?.message?.content ?? ""
      setMessages((m) => [...m, { role: "assistant", content: reply || "(empty response)" }])
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: e?.message || "Request failed. Please try again.", error: true }])
    } finally {
      setSending(false)
      scrollDown()
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CURL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <AppShell>
      <PageHeader
        title="Chat"
        description={<>Inference playground · {LIVE_MODEL.id} · OpenAI-compatible</>}
        actions={
          <>
            <Badge variant="success" className="hidden sm:inline-flex font-mono text-[10px]">
              {LIVE_MODEL.contextLabel} context
            </Badge>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Docs
            </Link>
          </>
        }
      />
      <PageContainer className="flex flex-col gap-4 space-y-0 lg:flex-row lg:items-start">
            <div className="flex h-[70dvh] min-h-[420px] min-w-0 flex-1 flex-col rounded-xl lg:sticky lg:top-0 lg:h-[calc(100dvh-8rem)] border border-border-dim bg-bg-secondary shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-dim px-3 py-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent-brand" />
                  <span className="text-xs font-semibold text-text-primary">Playground</span>
                  <Badge variant="outline" className="font-mono text-[10px]">{LIVE_MODEL.id}</Badge>
                  <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px]">{PRICE}</Badge>
                </div>
                <label className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-text-tertiary" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-seedinfer-…"
                    aria-label="API key"
                    autoComplete="off"
                    className="h-7 w-[200px] rounded-md border border-border-default bg-bg-primary px-2 font-mono text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-brand"
                  />
                </label>
              </div>

              <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                        m.role === "user"
                          ? "bg-accent-brand text-white"
                          : m.error
                            ? "border border-accent-red/30 bg-accent-red/10 text-text-primary"
                            : "border border-border-dim bg-bg-primary text-text-primary"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div className={`mt-1 font-mono text-[10px] ${m.role === "user" ? "text-white/70" : "text-text-tertiary"}`}>
                        {m.role === "user" ? "you" : `seedinfer · ${LIVE_MODEL.shortName}`}
                      </div>
                    </div>
                  </div>
                ))}
                {sending && <div className="font-mono text-xs text-text-tertiary">Generating…</div>}
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
                  Requests use <code className="rounded bg-bg-tertiary px-1">POST {API_BASE_URL}/chat/completions</code> and are billed at{" "}
                  {PRICE}. Your key stays in this browser tab.
                </p>
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[380px]">
              <Card className="border border-accent-brand/20 bg-accent-brand/10">
                <CardContent className="p-3 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-accent-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-text-primary">OpenAI-compatible API</div>
                    <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                      Use any OpenAI SDK with <code className="rounded bg-bg-tertiary px-1">base_url={API_BASE_URL}</code> and{" "}
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
                    <Badge variant="success" className="font-mono text-[10px]">OpenAI compatible</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">stream</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">cached input free</Badge>
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
                    <div className="font-semibold text-text-primary">{LIVE_MODEL.id}</div>
                    <div className="text-text-secondary">
                      {LIVE_MODEL.name} · {LIVE_MODEL.contextLabel} context · {PRICE}
                    </div>
                    <div className="mt-1 text-[11px] text-text-tertiary">{CACHE_POLICY.label}. More models coming soon — see /models.</div>
                  </div>
                </CardContent>
              </Card>
            </div>
      </PageContainer>
    </AppShell>
  )
}

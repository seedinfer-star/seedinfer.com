"use client"
import { useState } from "react"
import Sidebar from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KeyRound, ExternalLink, Clock, Copy, Check, Eye, EyeOff, Shield } from "lucide-react"

export default function SettingsPage() {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const mockKey = "sk-seedinfer-xxxxxxxxxxxxxxxxxxxx"

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mockKey)
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
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Settings</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">API keys · team · preferences — Coming soon</p>
          </div>
          <a
            href="https://docs.seedinfer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            docs.seedinfer.com <ExternalLink className="h-3 w-3" />
          </a>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
            <Card className="border border-amber-500/20 bg-amber-500/10">
              <CardContent className="p-3 flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary">Coming soon — proxy to docs.seedinfer.com</div>
                  <div className="mt-0.5 text-xs leading-4 text-text-secondary">
                    Settings will proxy <code className="rounded bg-bg-tertiary px-1">GET /v1/keys</code> &{" "}
                    <code className="rounded bg-bg-tertiary px-1">POST /v1/keys</code> (API key rotation, scopes) to{" "}
                    <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-brand underline">
                      docs.seedinfer.com
                    </a>
                    . Currently mock UI.
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-500/20 bg-bg-secondary font-mono text-[10px]">Coming soon</Badge>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border border-border-dim bg-bg-secondary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[13px]">
                    <KeyRound className="h-4 w-4 text-accent-brand" />
                    API keys
                    <Badge variant="outline" className="font-mono text-[10px]">mock</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-border-dim bg-bg-primary p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Default key</div>
                      <Badge variant="success" className="font-mono text-[9px]">active</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={revealed ? mockKey : "•".repeat(32)}
                        readOnly
                        className="h-9 flex-1 font-mono text-xs"
                      />
                      <button
                        onClick={() => setRevealed((v) => !v)}
                        className="rounded-lg border border-border-default bg-bg-tertiary p-2 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
                        aria-label="Reveal"
                      >
                        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={copy}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-text-tertiary">
                      Use as <code className="rounded bg-bg-tertiary px-1">Authorization: Bearer $SEEDINFER_API_KEY</code> for{" "}
                      <code className="rounded bg-bg-tertiary px-1">POST /v1/chat/completions</code>.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button disabled className="opacity-60">
                      <KeyRound className="mr-2 h-4 w-4" />
                      Create new key — Coming soon
                    </Button>
                    <Button variant="outline" disabled className="opacity-60">
                      Revoke — Coming soon
                    </Button>
                  </div>

                  <div className="rounded-xl border border-dashed border-border-default bg-bg-primary/60 p-3">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                      <Shield className="h-3 w-3" /> Scopes (coming soon)
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["chat:write", "models:read", "billing:read", "keys:manage"].map((s) => (
                        <span key={s} className="rounded-full border border-border-dim bg-bg-tertiary px-2.5 py-1 font-mono text-[11px] text-text-secondary opacity-60">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Card className="border border-border-dim bg-bg-secondary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-mono uppercase tracking-wide text-text-tertiary">Preferences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-text-secondary">
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-border-dim bg-bg-primary px-3 py-2 opacity-60">
                      <span>Theme</span>
                      <span className="font-mono text-[11px] text-text-tertiary">dark — soon</span>
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-border-dim bg-bg-primary px-3 py-2 opacity-60">
                      <span>Base URL</span>
                      <span className="font-mono text-[11px] text-text-tertiary">api.seedinfer.com</span>
                    </label>
                    <p className="font-mono text-[10px] text-text-tertiary">
                      Docs: <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">docs.seedinfer.com</a>
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-border-dim bg-bg-secondary">
                  <CardContent className="p-3 font-mono text-[11px] leading-4 text-text-tertiary">
                    Mock keys only — real key management via <code className="rounded bg-bg-tertiary px-1">POST /v1/keys</code> after proxy cutover.
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Settings — API keys & scopes · Coming soon — proxy to{" "}
              <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">
                docs.seedinfer.com
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

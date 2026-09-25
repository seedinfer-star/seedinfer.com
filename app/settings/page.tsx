"use client"
import { useState } from "react"
import Link from "next/link"
import AppShell, { PageHeader, PageContainer } from "@/components/app-shell"
import ThemeToggle from "@/components/theme-toggle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { KeyRound, FileText, Copy, Check, Shield } from "lucide-react"
import { API_BASE_URL, GITHUB_URL } from "@/lib/catalog"
import AccountPanel from "@/components/account/account-panel"

export default function SettingsPage() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(API_BASE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Account · API keys · preferences"
        actions={
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <FileText className="h-3.5 w-3.5" /> Docs
          </Link>
        }
      />
      <PageContainer>
            <AccountPanel />
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 border border-border-dim bg-bg-secondary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[13px]">
                    <KeyRound className="h-4 w-4 text-accent-brand" />
                    API keys
                    <Badge variant="outline" className="font-mono text-[10px]">coming soon</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-dashed border-border-default bg-bg-primary p-4">
                    <div className="text-sm font-semibold text-text-primary">Self-service API keys are coming soon</div>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      You will be able to create, rotate and revoke keys here. Keys are used as{" "}
                      <code className="rounded bg-bg-tertiary px-1">Authorization: Bearer sk-seedinfer-...YOUR_KEY</code> for{" "}
                      <code className="rounded bg-bg-tertiary px-1">POST {API_BASE_URL}/chat/completions</code>. To get early access, open an issue on{" "}
                      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">GitHub</a>.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 rounded-xl border border-border-dim bg-bg-primary p-3">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Pay-as-you-go key</span>
                        <Badge variant="outline" className="border-accent-green/30 font-mono text-[9px] text-accent-green">Standard priority</Badge>
                      </div>
                      <code className="block font-mono text-xs text-text-primary">sk_live_…</code>
                      <p className="font-mono text-[11px] leading-4 text-text-tertiary">Draws from your credit balance. Routed at standard (highest) priority.</p>
                    </div>
                    <div className="space-y-1.5 rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wide text-accent-amber">Subscription key</span>
                        <Badge variant="outline" className="border-accent-amber/30 font-mono text-[9px] text-accent-amber">Background priority</Badge>
                      </div>
                      <code className="block font-mono text-xs text-text-primary">sk_sub_…</code>
                      <p className="font-mono text-[11px] leading-4 text-text-tertiary">
                        Issued with a GO / GOAT / PRO plan. Uses the plan quota and is routed at background priority.
                      </p>
                    </div>
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
                    <div className="flex flex-col gap-2 rounded-xl border border-border-dim bg-bg-primary p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">Theme Appearance</span>
                        <span className="font-mono text-[10px] text-text-tertiary">White / Dark</span>
                      </div>
                      <div className="pt-1">
                        <ThemeToggle variant="segmented" className="w-full justify-center" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-border-dim bg-bg-primary px-3 py-2.5">
                      <span className="font-medium text-text-primary">Base API URL</span>
                      <button onClick={copy} className="inline-flex items-center gap-1 font-mono text-[11px] text-text-tertiary hover:text-text-primary">
                        {API_BASE_URL} {copied ? <Check className="h-3 w-3 text-accent-green" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>

            <div className="border-t border-border-dim pt-4 font-mono text-[10px] leading-4 text-text-tertiary">
              SeedInfer.com · Settings
            </div>
      </PageContainer>
    </AppShell>
  )
}

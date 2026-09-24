"use client"

import { useState } from "react"
import { Mail, Send, CheckCircle2, Copy, Sparkles, Server, HardDrive, Cpu } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export default function ProviderContactForm({ variant = "card" }: { variant?: "card" | "inline" | "compact" }) {
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    gpu: "",
    vram: "",
    os: "Ubuntu 24.04",
    internet: "1 Gbps Up/Down",
    notes: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const generateMailto = () => {
    const subject = encodeURIComponent(`SeedInfer Custom Node Application - ${formData.gpu || "Custom Hardware"}`)
    const body = encodeURIComponent(
      `Hello SeedInfer Team,\n\nI would like to apply to join SeedInfer as a Node Provider with custom/non-standard hardware:\n\n` +
      `• Name / Handle: ${formData.name || "N/A"}\n` +
      `• Contact Email: ${formData.email || "N/A"}\n` +
      `• GPU Hardware: ${formData.gpu || "N/A"}\n` +
      `• Total VRAM: ${formData.vram || "N/A"}\n` +
      `• OS & Driver: ${formData.os || "N/A"}\n` +
      `• Connection: ${formData.internet || "N/A"}\n` +
      `• Additional Notes: ${formData.notes || "None"}\n\n` +
      `Looking forward to hearing from you!`
    )
    return `mailto:seedinfer@gmail.com?subject=${subject}&body=${body}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    window.location.href = generateMailto()
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText("seedinfer@gmail.com")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Card className="border border-accent-brand/30 bg-gradient-to-br from-accent-brand/10 via-bg-secondary to-bg-secondary shadow-lg overflow-hidden">
      <CardHeader className="pb-3 border-b border-border-dim/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-text-primary">
            <Sparkles className="h-4 w-4 text-accent-brand" />
            Custom Hardware Application — Custom & Non-Standard Nodes
          </CardTitle>
          <Badge variant="outline" className="font-mono text-[10px] border-accent-brand/40 text-accent-brand bg-accent-brand/10">
            seedinfer@gmail.com
          </Badge>
        </div>
        <p className="mt-1 text-xs text-text-secondary leading-5">
          Don't meet the standard <strong className="text-text-primary">RTX 5090 (32GB)</strong> requirements but have custom GPUs (e.g. RTX 4090, 3090, A100, H100, multi-GPU rigs, data center servers)? Submit your setup below to apply for custom provider onboarding.
        </p>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {submitted ? (
          <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 p-4 text-center space-y-3">
            <CheckCircle2 className="h-8 w-8 text-accent-green mx-auto" />
            <h4 className="text-sm font-bold text-text-primary">Application Mail Draft Opened!</h4>
            <p className="font-mono text-xs text-text-secondary leading-5 max-w-md mx-auto">
              If your email client didn't open automatically, send your application directly to:
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 font-mono text-xs font-semibold text-accent-brand">
              seedinfer@gmail.com
              <button onClick={copyEmail} className="text-text-tertiary hover:text-text-primary">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={() => setSubmitted(false)} className="text-xs">
                Submit another application
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="font-mono text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                  Name / Handle *
                </label>
                <Input
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Alex / NodeOperator_01"
                  className="h-9 font-mono text-xs bg-bg-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                  Email Address *
                </label>
                <Input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. operator@domain.com"
                  className="h-9 font-mono text-xs bg-bg-primary"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="font-mono text-[11px] font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-accent-brand" /> GPU Model & Count *
                </label>
                <Input
                  required
                  name="gpu"
                  value={formData.gpu}
                  onChange={handleChange}
                  placeholder="e.g. 2x RTX 4090 / 1x A100"
                  className="h-9 font-mono text-xs bg-bg-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[11px] font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-accent-brand" /> VRAM Total *
                </label>
                <Input
                  required
                  name="vram"
                  value={formData.vram}
                  onChange={handleChange}
                  placeholder="e.g. 48GB (24GB x 2)"
                  className="h-9 font-mono text-xs bg-bg-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[11px] font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-1">
                  <Server className="h-3 w-3 text-accent-brand" /> OS & Driver
                </label>
                <Input
                  name="os"
                  value={formData.os}
                  onChange={handleChange}
                  placeholder="Ubuntu 24.04, Driver 580+"
                  className="h-9 font-mono text-xs bg-bg-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                Hardware Setup & Network Notes
              </label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Describe your internet bandwidth, cooling, location, or custom questions..."
                className="w-full rounded-lg border border-border-default bg-bg-primary p-2.5 font-mono text-xs text-text-primary focus:border-accent-brand focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 font-mono text-[11px] text-text-tertiary">
                <Mail className="h-3.5 w-3.5 text-accent-brand shrink-0" />
                Direct Mail recipient: <strong className="text-text-primary">seedinfer@gmail.com</strong>
                <button type="button" onClick={copyEmail} className="text-accent-brand hover:underline">
                  {copied ? "(Copied!)" : "(Copy Email)"}
                </button>
              </div>

              <Button type="submit" className="bg-accent-brand hover:bg-accent-brand-hover text-white font-semibold text-xs h-9 px-4">
                <Send className="mr-2 h-3.5 w-3.5" /> Submit Application to seedinfer@gmail.com
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

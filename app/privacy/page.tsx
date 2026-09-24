import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — SeedInfer",
  description: "SeedInfer Privacy Policy. Zero-data logging architecture, prompt handling, data retention, and your rights.",
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "2025-01-15"

  return (
    <main className="min-h-screen bg-bg-primary py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <header className="text-center space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            ← Back to SeedInfer
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            Privacy Policy
          </h1>
          <p className="text-sm text-text-tertiary">
            Last updated: {lastUpdated}
          </p>
        </header>

        {/* Executive Summary */}
        <section className="rounded-2xl border border-accent-brand/20 bg-accent-brand/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">◆</span> Executive Summary
          </h2>
          <div className="prose prose-invert max-w-none text-sm text-text-secondary space-y-3">
            <p>
              <strong>SeedInfer operates on a strict Zero-Data Logging architecture.</strong> We do not store, log, or retain your prompts, completions, or any inference request payloads. All inference processing occurs strictly in volatile GPU memory (VRAM/RAM) and is discarded immediately after token generation completes.
            </p>
            <p>
              We collect only <strong>aggregated, anonymized traffic statistics</strong> (median latency, request volume, geographic distribution, token throughput) for network routing optimization and capacity planning. No request content is ever persisted to disk.
            </p>
          </div>
        </section>

        {/* Data We Do NOT Collect */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-red">■</span> Data We Do NOT Collect or Store
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-2">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-accent-red">✕</span> Prompts & User Inputs
              </h3>
              <p className="text-sm text-text-secondary ml-6">
                Never written to disk. Processed in VRAM only. Discarded immediately after token generation. No KV cache persistence across requests.
              </p>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-2">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-accent-red">✕</span> Model Completions & Outputs
              </h3>
              <p className="text-sm text-text-secondary ml-6">
                Streamed directly to client via SSE. No server-side buffering or storage. Zero retention.
              </p>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-2">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-accent-red">✕</span> Conversation History / Context
              </h3>
              <p className="text-sm text-text-secondary ml-6">
                No conversation state stored. Each request is stateless. Context window managed client-side or passed per-request.
              </p>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-2">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-accent-red">✕</span> Personal Identifiers (Email, IP, Wallet Address linked to requests)
              </h3>
              <p className="text-sm text-text-secondary ml-6">
                API keys are authenticated but not linked to request payloads in any persistent store. Routing layer sees only encrypted traffic metadata.
              </p>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-2">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <span className="text-accent-red">✕</span> Training Data / Model Fine-tuning
              </h3>
              <p className="text-sm text-text-secondary ml-6">
                <strong>We do not use your prompts or completions for model training, fine-tuning, RLHF, or any ML pipeline.</strong> Your data never enters any training dataset.
              </p>
            </div>
          </div>
        </section>

        {/* Data We DO Collect (Aggregated Only) */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-green">■</span> Aggregated Traffic Statistics (Anonymous)
          </h2>
          <p className="text-sm text-text-secondary">
            The following metrics are collected <strong>without any request content, user identifiers, or payload data</strong>:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-4 space-y-1">
              <h4 className="font-mono text-xs uppercase tracking-wide text-text-tertiary">Latency Metrics</h4>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                <li>Median Time to First Token (TTFT)</li>
                <li>P50 / P95 / P99 latency percentiles</li>
                <li>Inter-token latency distribution</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-4 space-y-1">
              <h4 className="font-mono text-xs uppercase tracking-wide text-text-tertiary">Throughput Metrics</h4>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                <li>Tokens per second (aggregate)</li>
                <li>Concurrent request count</li>
                <li>Queue depth per node</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-4 space-y-1">
              <h4 className="font-mono text-xs uppercase tracking-wide text-text-tertiary">Geographic / Network</h4>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                <li>Client region (coarse, via routing layer)</li>
                <li>Node region (for proximity routing)</li>
                <li>Network path characteristics</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-4 space-y-1">
              <h4 className="font-mono text-xs uppercase tracking-wide text-text-tertiary">Error & Health</h4>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                <li>Error rates by type (timeout, OOM, network)</li>
                <li>Node uptime / availability</li>
                <li>Hardware health signals (temp, utilization)</li>
              </ul>
            </div>
          </div>
          <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/10 p-4 text-sm text-text-secondary">
            <strong>Purpose:</strong> These aggregated metrics feed the EWMA (Exponentially Weighted Moving Average) routing algorithm to dynamically route requests to the nearest, highest-performing node. They are also used for capacity planning and network health monitoring.
          </div>
        </section>

        {/* Prompt & Completion Handling — Technical Deep Dive */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">■</span> Prompt & Completion Handling — Technical Deep Dive
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">Request Lifecycle</h3>
              <ol className="list-decimal pl-5 text-sm text-text-secondary space-y-2">
                <li><strong>Ingress:</strong> Request hits SeedInfer gateway (Orange Pi 4 Pro routing layer) via HTTPS/TLS.</li>
                <li><strong>Routing:</strong> EWMA algorithm selects optimal provider node based on real-time latency/throughput. No payload inspection.</li>
                <li><strong>Forward:</strong> Request forwarded via encrypted WireGuard (Tailscale) tunnel to provider node.</li>
                <li><strong>Inference:</strong> vLLM engine loads prompt into GPU VRAM. KV cache allocated in VRAM (FP8 via <code className="bg-bg-tertiary px-1 rounded text-xs">--kv-cache-dtype fp8</code>).</li>
                <li><strong>Generation:</strong> Tokens streamed back via SSE through same encrypted tunnel.</li>
                <li><strong>Cleanup:</strong> <strong>Immediately after stream ends</strong>, KV cache freed, prompt tokens evicted from VRAM. No disk write occurs.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">VRAM Cache Behavior (cv cache)</h3>
              <p className="text-sm text-text-secondary">
                The vLLM KV cache resides exclusively in GPU VRAM. It functions as a <strong>transient compute buffer</strong>, not persistent storage. Cache entries are:
              </p>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1 ml-4">
                <li>Allocated per-request (or prefix-cached for shared prefixes within same session)</li>
                <li>Freed immediately upon request completion or client disconnect</li>
                <li>Never serialized to disk, never checkpointed, never backed up</li>
                <li>Subject to GPU memory pressure eviction (LRU) automatically by vLLM</li>
              </ul>
              <p className="text-sm text-text-secondary">
                <strong>Retention duration:</strong> Exactly the duration of the inference request (typically 100ms – 30s). Zero persistence beyond that.
              </p>
            </div>
          </div>
        </section>

        {/* OpenRouter Compatibility */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">■</span> OpenRouter Compatibility
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <p className="text-sm text-text-secondary">
              SeedInfer is fully compatible with OpenRouter's privacy model. When requests are routed via OpenRouter:
            </p>
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
              <li>OpenRouter acts as the data controller for requests originating from their platform</li>
              <li>SeedInfer receives only the forwarded request payload — no additional user context</li>
              <li>Our zero-logging guarantee applies identically: no prompt/completion storage on our infrastructure</li>
              <li>Aggregated routing metrics (latency, throughput) are shared with OpenRouter for their routing optimization, <strong>without any payload content</strong></li>
            </ul>
            <p className="text-sm text-text-secondary">
              If OpenRouter has specific data processing agreements or retention requirements, those govern the OpenRouter → client relationship. SeedInfer's infrastructure adds no additional retention.
            </p>
          </div>
        </section>

        {/* Provider Node Isolation */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">■</span> Provider Node Isolation
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <p className="text-sm text-text-secondary">
              Provider nodes (RTX 5090 operators) run the vLLM engine in isolated Docker containers with:
            </p>
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
              <li><strong>No persistent volumes</strong> mounted for inference workloads</li>
              <li><strong>Read-only root filesystem</strong> for container (except /tmp for transient cache)</li>
              <li><strong>Hardware fingerprint lock (SHA-256)</strong> binding identity to physical GPU/CPU — prevents container cloning</li>
              <li><strong>Ed25519 keypair</strong> for node authentication — private key never leaves node, stored at <code className="bg-bg-tertiary px-1 rounded text-xs">/etc/seedinfer/identity.key</code> (0600 perms)</li>
              <li><strong>Outbound-only networking</strong> via Tailscale — no inbound ports, no public IP required</li>
            </ul>
            <p className="text-sm text-text-secondary">
              Provider operators <strong>cannot access</strong> request payloads, prompts, or completions. The container processes inference only.
            </p>
          </div>
        </section>

        {/* Data Retention Summary */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">■</span> Data Retention Summary
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border-dim">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-tertiary text-[10px] uppercase tracking-wide text-text-tertiary">
                <tr>
                  <th className="px-4 py-3">Data Category</th>
                  <th className="px-4 py-3">Retention</th>
                  <th className="px-4 py-3">Storage Location</th>
                  <th className="px-4 py-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dim text-text-secondary">
                <tr className="bg-accent-red/10">
                  <td className="px-4 py-3 font-mono">Prompts / Inputs</td>
                  <td className="px-4 py-3 font-semibold text-accent-red">Zero (VRAM only)</td>
                  <td className="px-4 py-3">GPU VRAM (volatile)</td>
                  <td className="px-4 py-3">Inference compute</td>
                </tr>
                <tr className="bg-accent-red/10">
                  <td className="px-4 py-3 font-mono">Completions / Outputs</td>
                  <td className="px-4 py-3 font-semibold text-accent-red">Zero (streamed)</td>
                  <td className="px-4 py-3">Network buffer → Client</td>
                  <td className="px-4 py-3">Delivery</td>
                </tr>
                <tr className="bg-accent-red/10">
                  <td className="px-4 py-3 font-mono">KV Cache</td>
                  <td className="px-4 py-3 font-semibold text-accent-red">Request duration only</td>
                  <td className="px-4 py-3">GPU VRAM (FP8)</td>
                  <td className="px-4 py-3">Attention computation</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">Aggregated Latency Metrics</td>
                  <td className="px-4 py-3">Rolling 30-day window</td>
                  <td className="px-4 py-3">Time-series DB (aggregated)</td>
                  <td className="px-4 py-3">EWMA routing optimization</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">Aggregated Throughput</td>
                  <td className="px-4 py-3">Rolling 30-day window</td>
                  <td className="px-4 py-3">Time-series DB (aggregated)</td>
                  <td className="px-4 py-3">Capacity planning</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">Node Health / Hardware</td>
                  <td className="px-4 py-3">Rolling 90-day window</td>
                  <td className="px-4 py-3">Time-series DB</td>
                  <td className="px-4 py-3">Fleet management, payouts</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">Provider Identity (PubKey)</td>
                  <td className="px-4 py-3">Duration of node registration</td>
                  <td className="px-4 py-3">Registry (encrypted)</td>
                  <td className="px-4 py-3">Authentication, payouts</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">Client API Key (hashed)</td>
                  <td className="px-4 py-3">Duration of key validity</td>
                  <td className="px-4 py-3">Auth DB (bcrypt)</td>
                  <td className="px-4 py-3">Authentication, billing</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Your Rights */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">■</span> Your Rights
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
              <li><strong>Access:</strong> You may request confirmation of what aggregated metrics exist for your API key (no payload data exists to provide).</li>
              <li><strong>Deletion:</strong> Revoke your API key in <Link href="/settings" className="text-accent-brand underline">Settings</Link> — all associated billing/auth data is purged within 30 days.</li>
              <li><strong>Portability:</strong> Not applicable — no personal data processed beyond auth/billing.</li>
              <li><strong>Objection:</strong> You may opt out of aggregated metrics collection by contacting us (may degrade routing quality).</li>
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-4 border-t border-border-dim pt-6">
          <h2 className="text-xl font-bold text-text-primary">Contact</h2>
          <p className="text-sm text-text-secondary">
            Questions about this policy or data practices: <a href="mailto:privacy@seedinfer.com" className="text-accent-brand underline">privacy@seedinfer.com</a>
          </p>
          <p className="text-sm text-text-secondary">
            For provider-specific inquiries: <a href="mailto:providers@seedinfer.com" className="text-accent-brand underline">providers@seedinfer.com</a>
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-dim pt-6 text-center text-xs text-text-tertiary">
          <p>SeedInfer.com · Decentralized P2P AI Inference · Zero-Data Logging Architecture</p>
          <p className="mt-1">
            <Link href="/terms" className="text-accent-brand underline hover:text-accent-brand-hover mr-4">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-accent-brand underline hover:text-accent-brand-hover">
              Privacy Policy
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}
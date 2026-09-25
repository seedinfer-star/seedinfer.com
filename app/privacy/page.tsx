import Link from "next/link"
import AppShell, { PageContainer } from "@/components/app-shell"
import { CACHE_POLICY, LAST_UPDATED, MIN_VRAM_GB, PROVIDER_ECONOMICS, pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata(
  "Privacy Policy",
  "SeedInfer Privacy Policy: zero-data logging architecture, prompt handling, data retention and your rights.",
  "/privacy",
)

const CACHE_TTL = `${CACHE_POLICY.ttlSeconds} s (max ${CACHE_POLICY.maxSeconds / 60} min)`

export default function PrivacyPolicyPage() {
  const lastUpdated = LAST_UPDATED

  return (
    <AppShell>
      <PageContainer wide={false}>
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <header className="text-center space-y-4 pt-4">
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
              <strong>SeedInfer operates on a strict Zero-Data Logging architecture.</strong> We do not store, log, or retain your prompts, completions, or any inference request payloads. All inference processing occurs in volatile GPU memory (VRAM/RAM). The only exception is the in-memory prefix (KV) cache, which may keep attention state for up to {CACHE_TTL} so repeated prompt prefixes are billed as free cached input; it is never written to disk.
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
                Never written to disk. Processed in VRAM only. Prompt-prefix KV cache blocks may be reused in memory for up to {CACHE_TTL} and are then evicted.
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
                <li>Median and tail latency percentiles</li>
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
                <li><strong>Cleanup:</strong> <strong>Immediately after stream ends</strong>, the request&apos;s KV cache is released; shared prefix blocks may stay in the in-memory prefix cache for up to {CACHE_TTL}. No disk write occurs.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">VRAM Cache Behavior (KV cache)</h3>
              <p className="text-sm text-text-secondary">
                The vLLM KV cache resides exclusively in GPU VRAM. It functions as a <strong>transient compute buffer</strong>, not persistent storage. Cache entries are:
              </p>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1 ml-4">
                <li>Allocated per request; blocks for shared prompt prefixes may be kept in the prefix cache</li>
                <li>Prefix-cache blocks expire after {CACHE_TTL}; all other blocks are freed on request completion or client disconnect</li>
                <li>Never serialized to disk, never checkpointed, never backed up</li>
                <li>Subject to GPU memory pressure eviction (LRU) automatically by vLLM</li>
              </ul>
              <p className="text-sm text-text-secondary">
                <strong>Retention duration:</strong> the duration of the inference request, plus at most {CACHE_TTL} for reusable prompt prefixes. Nothing persists beyond that.
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
              Provider nodes (NVIDIA GPUs with at least {MIN_VRAM_GB}GB VRAM) run the vLLM engine in isolated Docker containers with:
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
                  <td className="px-4 py-3 font-semibold text-accent-red">Request duration (prefix cache ≤ {CACHE_TTL})</td>
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

        {/* Account data */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">■</span> Account Data We Store
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3 text-sm text-text-secondary">
            <p>If you create an account, we store only what is needed to sign you in and bill you:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Profile:</strong> email address, whether it is verified, optional display name and avatar URL, sign-up and last sign-in time.</li>
              <li><strong>Sign-in methods:</strong> a bcrypt hash of your password (never the password itself) and, if you use Google or GitHub, the provider&apos;s account ID, email and username. We request only basic profile and email scopes and do not keep provider access tokens.</li>
              <li><strong>Sessions:</strong> creation/expiry time, sign-in method and browser user-agent of each active session, so you can review and revoke them.</li>
              <li><strong>Billing:</strong> credit balance, invoices (chain, token, amount, transaction hash, status) and per-request usage (model, token counts, cost). Prompts and completions are never stored.</li>
              <li><strong>Provider data (only if you run nodes):</strong> node tokens (stored only as SHA-256 hashes, plus name, prefix and creation/last-use/revocation timestamps — never the token itself), node-to-account bindings (node id, bound token, binding and last-seen times), your payout wallet address ({PROVIDER_ECONOMICS.payoutAsset} on {PROVIDER_ECONOMICS.payoutChain}) and the security log of payout-wallet and token changes.</li>
            </ul>
            <p>
              Data is kept in a SQLite database on our own server, readable only by the service account, with rotating backups kept for up to 7 days. It is not sold or
              shared, except with the OAuth provider you choose during sign-in.
            </p>
          </div>
        </section>

        {/* Your Rights */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">■</span> Your Rights
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
              <li><strong>Access &amp; portability:</strong> download everything stored about your account as JSON in <Link href="/settings" className="text-accent-brand underline">Settings → Your data</Link> — including node tokens (metadata only), node bindings, your payout wallet and the security log.</li>
              <li><strong>Rectification:</strong> change your display name, password and linked Google/GitHub accounts in Settings.</li>
              <li><strong>Deletion:</strong> delete your account in Settings — your profile, sign-in methods, sessions, credits and invoices are removed immediately, together with your node tokens, node bindings, payout wallet and security log; usage records are kept only in anonymized form. Copies in backups expire within 7 days.</li>
              <li><strong>Session control:</strong> review active sessions and sign out of all other devices in Settings.</li>
              <li><strong>Objection:</strong> you may opt out of aggregated metrics collection by contacting us (may degrade routing quality).</li>
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
      </PageContainer>
    </AppShell>
  )
}
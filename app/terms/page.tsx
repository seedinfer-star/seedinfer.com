import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service — SeedInfer",
  description: "SeedInfer Terms of Service. Decentralized P2P AI inference network terms, provider obligations, client usage, and liability.",
}

export default function TermsOfServicePage() {
  const lastUpdated = "2025-01-15"
  const effectiveDate = "2025-01-15"

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
            Terms of Service
          </h1>
          <p className="text-sm text-text-tertiary">
            Last updated: {lastUpdated} · Effective: {effectiveDate}
          </p>
        </header>

        {/* Acceptance */}
        <section className="rounded-2xl border border-accent-brand/20 bg-accent-brand/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">◆</span> Acceptance of Terms
          </h2>
          <div className="prose prose-invert max-w-none text-sm text-text-secondary space-y-3">
            <p>
              By accessing or using SeedInfer's API, website, provider software, or any related services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you ("User", "Client", or "Provider") and SeedInfer ("Company", "we", "us", "our").
            </p>
          </div>
        </section>

        {/* Definitions */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">1.</span> Definitions
          </h2>
          <div className="space-y-3">
            <dl className="space-y-3">
              <div className="rounded-xl border border-border-dim bg-bg-secondary p-4">
                <dt className="font-semibold text-text-primary">"Client"</dt>
                <dd className="text-sm text-text-secondary mt-1">Any person or entity accessing the API to run inference requests.</dd>
              </div>
              <div className="rounded-xl border border-border-dim bg-bg-secondary p-4">
                <dt className="font-semibold text-text-primary">"Provider"</dt>
                <dd className="text-sm text-text-secondary mt-1">Any person or entity operating a verified hardware node (GPU) connected to the SeedInfer network via the Provider Agent software.</dd>
              </div>
              <div className="rounded-xl border border-border-dim bg-bg-secondary p-4">
                <dt className="font-semibold text-text-primary">"Network"</dt>
                <dd className="text-sm text-text-secondary mt-1">The decentralized P2P inference infrastructure comprising the Gateway, routing layer, and Provider nodes.</dd>
              </div>
              <div className="rounded-xl border border-border-dim bg-bg-secondary p-4">
                <dt className="font-semibold text-text-primary">"API Key"</dt>
                <dd className="text-sm text-text-secondary mt-1">Authentication credential (sk_live_..., sk_sub_..., or demo key) used to authorize API requests.</dd>
              </div>
              <div className="rounded-xl border border-border-dim bg-bg-secondary p-4">
                <dt className="font-semibold text-text-primary">"USDC / Base Chain"</dt>
                <dd className="text-sm text-text-secondary mt-1">USD Coin on the Base L2 network, used for provider payouts and client billing.</dd>
              </div>
              <div className="rounded-xl border border-border-dim bg-bg-secondary p-4">
                <dt className="font-semibold text-text-primary">"Zero-Data Logging"</dt>
                <dd className="text-sm text-text-secondary mt-1">Architectural guarantee that no prompt, completion, or request payload is persisted to any durable storage. See <Link href="/privacy" className="text-accent-brand underline">Privacy Policy</Link>.</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Client Terms */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">2.</span> Client Terms — API Usage
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">2.1 API Access & Authentication</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>Clients authenticate via API Key in the <code className="bg-bg-tertiary px-1 rounded text-xs">Authorization: Bearer YOUR_KEY</code> header.</li>
                <li>Demo key <code className="bg-bg-tertiary px-1 rounded text-xs">sk-seedinfer-demo</code> is provided for evaluation; rate-limited and subject to revocation.</li>
                <li>Pay-As-You-Go keys (<code className="bg-bg-tertiary px-1 rounded text-xs">sk_live_...</code>) deduct from prepaid credit balance.</li>
                <li>Subscription keys (<code className="bg-bg-tertiary px-1 rounded text-xs">sk_sub_...</code>) are tied to monthly plans (GO, GOAT, PRO) with volume multipliers at background priority.</li>
                <li>Keys are non-transferable. Sharing, reselling, or publishing keys is prohibited.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">2.2 Acceptable Use</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>Use the API for lawful purposes only. No illegal activities, spam, harassment, or abuse.</li>
                <li>No attempts to extract model weights, reverse-engineer the routing layer, or probe provider infrastructure.</li>
                <li>No automated scraping of model outputs for training competing models (distillation) without explicit written permission.</li>
                <li>Respect rate limits. Excessive concurrent requests may be throttled or rejected.</li>
                <li>Do not circumvent geographic routing or attempt to target specific provider nodes.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">2.3 Billing & Credits</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>Pay-As-You-Go: Credits purchased in advance. Consumed per-token at published rates. Non-refundable except as required by law.</li>
                <li>Subscriptions: Monthly recurring billing. Volume multipliers (2x–4x) apply at <strong>background priority</strong> (lower latency priority than Pay-As-You-Go).</li>
                <li>Prices in USD. USDC on Base Chain accepted at 1:1. Rates subject to change with 30-day notice.</li>
                <li>Unused subscription quota does not roll over. Pay-As-You-Go credits expire after 12 months of inactivity.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">2.4 Service Levels</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>SeedInfer provides <strong>best-effort</strong> inference on decentralized hardware. No uptime SLA for free/demo tiers.</li>
                <li>Subscription tiers include priority routing but no guaranteed latency or availability.</li>
                <li>Model availability subject to provider fleet composition. Models may be added/removed with notice.</li>
                <li>Routing uses EWMA algorithm; clients cannot select specific nodes.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Provider Terms */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">3.</span> Provider Terms — Node Operation
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">3.1 Hardware Requirements</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>Minimum: NVIDIA RTX 5090 32GB (Blackwell GB202), Ubuntu 24.04+, Driver ≥580.65, CUDA 13.3, Docker 24+ with nvidia-container-toolkit.</li>
                <li>Community Tier: RTX 4090/3090 24GB supported with reduced context length (<code className="bg-bg-tertiary px-1 rounded text-xs">VLLM_MAX_MODEL_LEN=131072</code>, <code className="bg-bg-tertiary px-1 rounded text-xs">GPU_MEMORY_UTILIZATION=0.80</code>).</li>
                <li>Enterprise Tier: A100 80GB / H100 80GB fully supported.</li>
                <li>Ports 47900 (vLLM) and 47901 (Agent) must be reachable via Tailscale (outbound only — no port forwarding needed).</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">3.2 Identity & Security</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>On first run, <code className="bg-bg-tertiary px-1 rounded text-xs">install.sh</code> generates an Ed25519 keypair at <code className="bg-bg-tertiary px-1 rounded text-xs">/etc/seedinfer/identity.key</code> (0600 perms). Private key never leaves the node.</li>
                <li>Public key = your Zero-Account ID. All payouts routed to this identifier.</li>
                <li>Hardware Fingerprint (SHA-256 of GPU UUID + motherboard serial + CPU ID) is cryptographically bound to your public key at registration. Prevents container cloning.</li>
                <li>You are responsible for securing your private key. Compromised keys = compromised identity & payouts.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">3.3 Payouts & Economics</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>Payouts in <strong>USDC on Base Chain only</strong>. You MUST register a valid EVM wallet address on Base in the <Link href="/provider/portal" className="text-accent-brand underline">Provider Portal</Link> to receive funds.</li>
                <li><strong>Standby Retainer:</strong> $0.40/day per node for each hour with ≥50% uptime. Accrues continuously, paid monthly.</li>
                <li><strong>Execution Revenue:</strong> 99% of net token revenue (after gateway fees) paid to provider. 1% protocol fee.</li>
                <li>No slashing for downtime. Nodes simply stop receiving traffic when offline.</li>
                <li>Payouts automated monthly. Minimum threshold: 10 USDC.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">3.4 Provider Obligations</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>Maintain hardware meeting minimum specs. Degraded hardware may be delisted.</li>
                <li>Run the official Provider Agent container unmodified. Modified binaries = immediate delisting.</li>
                <li>Keep Tailscale container running (isolated from personal tailnet).</li>
                <li>No logging, inspection, or retention of request payloads. Zero-Data Logging is mandatory.</li>
                <li>Comply with applicable laws in your jurisdiction (data protection, export controls, etc.).</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
              <h3 className="font-semibold text-text-primary">3.5 Delisting & Termination</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>We may delist nodes for: hardware non-compliance, modified software, security violations, extended offline periods ({">"}7 days), or legal requirements.</li>
                <li>Delisted nodes cease receiving traffic immediately. Accrued retainers & execution revenue paid out per normal schedule.</li>
                <li>You may voluntarily deregister at any time via Provider Portal.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Intellectual Property */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">4.</span> Intellectual Property
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
              <li>SeedInfer software (Gateway, Agent, Router, SDKs) is proprietary. No license granted except API access per these Terms.</li>
              <li>Model weights (Gemma, Nemotron, etc.) are subject to their respective licenses (Google, NVIDIA). SeedInfer provides inference compute only.</li>
              <li>Clients retain ownership of their prompts/completions. SeedInfer claims no rights (and stores none — see Privacy Policy).</li>
              <li>Providers retain ownership of their hardware. SeedInfer claims no rights to provider infrastructure.</li>
            </ul>
          </div>
        </section>

        {/* Disclaimer & Limitation of Liability */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">5.</span> Disclaimers & Limitation of Liability
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <h3 className="font-semibold text-text-primary">5.1 No Warranties</h3>
            <p className="text-sm text-text-secondary">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED/ERROR-FREE OPERATION.
            </p>
            <h3 className="font-semibold text-text-primary">5.2 Model Outputs</h3>
            <p className="text-sm text-text-secondary">
              AI model outputs are generated probabilistically. SeedInfer does not guarantee accuracy, completeness, safety, or legality of any completion. Clients are solely responsible for validating outputs before use.
            </p>
            <h3 className="font-semibold text-text-primary">5.3 Limitation of Liability</h3>
            <p className="text-sm text-text-secondary">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SEEDINFER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM OR RELATED TO THE SERVICE. TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY CLIENT IN THE 3 MONTHS PRECEDING THE CLAIM (OR 100 USDC FOR PROVIDERS).
            </p>
          </div>
        </section>

        {/* Indemnification */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">6.</span> Indemnification
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <p className="text-sm text-text-secondary">
              You agree to indemnify and hold harmless SeedInfer, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from: (a) your use of the Service in violation of these Terms; (b) your prompts, completions, or applications built on the API; (c) your violation of any law or third-party rights; (d) Provider: hardware failures, security breaches, or non-compliance with Section 3.
            </p>
          </div>
        </section>

        {/* Termination */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">7.</span> Termination
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
              <li>Either party may terminate at any time. Clients: revoke API key in Settings. Providers: deregister in Provider Portal.</li>
              <li>We may suspend/terminate immediately for: material breach, illegal activity, security threats, or legal compulsion.</li>
              <li>Upon termination: API access revoked, Provider nodes delisted, accrued payouts paid per schedule, no refunds for unused subscription time.</li>
              <li>Surviving sections: 4 (IP), 5 (Disclaimers), 6 (Indemnification), 8 (Governing Law), 9 (General).</li>
            </ul>
          </div>
        </section>

        {/* Governing Law */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">8.</span> Governing Law & Dispute Resolution
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <p className="text-sm text-text-secondary">
              These Terms governed by the laws of <strong>Estonia</strong> (EU), without regard to conflict of laws. Disputes resolved in courts of Tallinn, Estonia. For consumer clients in EU: mandatory consumer protection laws of your residence country apply.
            </p>
          </div>
        </section>

        {/* General */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span className="text-accent-brand">9.</span> General Provisions
          </h2>
          <div className="rounded-xl border border-border-dim bg-bg-secondary p-5 space-y-3">
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
              <li><strong>Entire Agreement:</strong> These Terms + Privacy Policy + any referenced policies constitute the entire agreement.</li>
              <li><strong>Amendments:</strong> We may update Terms with 30-day notice via email or dashboard banner. Continued use = acceptance.</li>
              <li><strong>Severability:</strong> If any provision is unenforceable, the remainder remains in effect.</li>
              <li><strong>No Waiver:</strong> Failure to enforce a right does not waive it.</li>
              <li><strong>Assignment:</strong> You may not assign these Terms. We may assign freely (e.g., corporate restructuring).</li>
              <li><strong>Force Majeure:</strong> Not liable for failures due to events beyond reasonable control.</li>
              <li><strong>Language:</strong> English version controls. Translations for convenience only.</li>
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-4 border-t border-border-dim pt-6">
          <h2 className="text-xl font-bold text-text-primary">Contact</h2>
          <p className="text-sm text-text-secondary">
            Legal inquiries: <a href="mailto:legal@seedinfer.com" className="text-accent-brand underline">legal@seedinfer.com</a>
          </p>
          <p className="text-sm text-text-secondary">
            Provider terms questions: <a href="mailto:providers@seedinfer.com" className="text-accent-brand underline">providers@seedinfer.com</a>
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-dim pt-6 text-center text-xs text-text-tertiary">
          <p>SeedInfer.com · Decentralized P2P AI Inference · Terms of Service</p>
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
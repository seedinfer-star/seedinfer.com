"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Wallet, Shield, ExternalLink } from "lucide-react"
import { useState } from "react"

type WalletAddr = {
  chain: string
  label: string
  address: string
  note?: string
  explorerUrl: string
  chainId?: number | string
}

const EVM_ADDRESS =
  (process.env.NEXT_PUBLIC_PAYMENT_ADDRESS as string) ||
  (process.env.NEXT_PUBLIC_EVM_ADDRESS as string) ||
  (process.env.NEXT_PUBLIC_BASE_ADDRESS as string) ||
  "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786"

const SOL_ADDRESS =
  (process.env.NEXT_PUBLIC_SOL_ADDRESS as string) ||
  (process.env.NEXT_PUBLIC_SOLANA_ADDRESS as string) ||
  "So11111111111111111111111111111111111111112"

// 7 chains: 6 EVM share same PAYMENT_ADDRESS + Solana separate
const WALLETS: WalletAddr[] = [
  {
    chain: "ETH",
    label: "Ethereum (ETH)",
    address: EVM_ADDRESS,
    note: "ETH · chain 1",
    explorerUrl: `https://etherscan.io/address/${EVM_ADDRESS}`,
    chainId: 1,
  },
  {
    chain: "Arbitrum",
    label: "Arbitrum (ETH)",
    address: EVM_ADDRESS,
    note: "Arbitrum · 42161",
    explorerUrl: `https://arbiscan.io/address/${EVM_ADDRESS}`,
    chainId: 42161,
  },
  {
    chain: "Polygon",
    label: "Polygon (POL)",
    address: EVM_ADDRESS,
    note: "Polygon · 137",
    explorerUrl: `https://polygonscan.com/address/${EVM_ADDRESS}`,
    chainId: 137,
  },
  {
    chain: "Base",
    label: "Base (ETH)",
    address: EVM_ADDRESS,
    note: "Base · 8453",
    explorerUrl: `https://basescan.org/address/${EVM_ADDRESS}`,
    chainId: 8453,
  },
  {
    chain: "BNB",
    label: "BNB Smart Chain",
    address: EVM_ADDRESS,
    note: "BNB · 56",
    explorerUrl: `https://bscscan.com/address/${EVM_ADDRESS}`,
    chainId: 56,
  },
  {
    chain: "HyperEVM",
    label: "HyperEVM (HYPE)",
    address: EVM_ADDRESS,
    note: "HyperEVM · 999",
    // Element requires refinement: HyperEVM explorer base URL placeholder — confirm official Hyperliquid explorer path
    explorerUrl: `https://explorer.hyperliquid.xyz/address/${EVM_ADDRESS}`,
    chainId: 999,
  },
  {
    chain: "Solana",
    label: "Solana (SOL)",
    address: SOL_ADDRESS,
    note: "Solana · SPL",
    explorerUrl: `https://solscan.io/account/${SOL_ADDRESS}`,
    chainId: "solana",
  },
]

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {}
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border-dim bg-bg-tertiary px-2 py-1 font-mono text-[10px] text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

export default function TransparencyFooter() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-accent-green" />
        <h2 className="text-[13px] font-semibold tracking-tight text-text-primary">Transparency</h2>
        <Badge
          variant="outline"
          className="border-border-dim bg-bg-tertiary font-mono text-[10px] uppercase tracking-wide text-text-tertiary"
        >
          verifiable · on-chain
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {WALLETS.map((w) => (
          <Card key={w.chain} className="border border-border-dim bg-bg-secondary">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  {w.chain}
                </span>
                <Badge
                  variant="outline"
                  className="ml-auto border-border-dim bg-bg-tertiary font-mono text-[9px] text-text-tertiary"
                >
                  {w.note}
                </Badge>
              </div>
              <div className="mt-2 text-xs font-medium text-text-primary">{w.label}</div>
              <div className="mt-1 break-all rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-2 font-mono text-[11px] leading-4 text-text-secondary">
                {w.address}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <CopyBtn text={w.address} />
                <a
                  href={w.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-accent-brand hover:underline"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border-dim bg-bg-secondary/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="font-mono text-[11px] leading-4 text-text-secondary">
            SeedInfer.com · Private inference on verified hardware ·{" "}
            <span className="text-text-tertiary">All payouts & attestations verifiable on-chain.</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <a href="https://etherscan.io/address/0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-brand hover:underline">
              Etherscan <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-border-default">·</span>
            <a href="https://solscan.io/account/So11111111111111111111111111111111111111112" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-brand hover:underline">
              Solscan <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-border-default">·</span>
            <a href="#" className="inline-flex items-center gap-1 text-accent-brand hover:underline">
              Attestation log <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <p className="font-mono text-[10px] leading-4 text-text-tertiary">
        Wallet addresses verifiable on-chain — EVM 0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786 valid on 6 chains (ETH, Arbitrum, Polygon, Base, BNB,
        HyperEVM) + Solana separate. Set via{" "}
        <code className="rounded bg-bg-tertiary px-1 py-0.5">PAYMENT_ADDRESS</code>{" "}
        <code className="rounded bg-bg-tertiary px-1 py-0.5">SOLANA_ADDRESS</code> /{" "}
        <code className="rounded bg-bg-tertiary px-1 py-0.5">NEXT_PUBLIC_PAYMENT_ADDRESS</code>{" "}
        <code className="rounded bg-bg-tertiary px-1 py-0.5">NEXT_PUBLIC_SOL_ADDRESS</code>. HyperEVM explorer link is placeholder —{" "}
        <span className="italic">Element requires refinement</span> for final Hyperliquid explorer URL.
      </p>
    </div>
  )
}

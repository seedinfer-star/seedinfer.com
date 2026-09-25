import BillingContent from "./billing-content"
import { CHAIN_CONFIG, type ChainKey } from "@/lib/payments/chains"
import { listTokenOptions } from "@/lib/payments/tokens"

// The token allowlists (ALLOWED_TOKENS_<CHAIN>) are server-only env vars, so they are resolved
// here, per request, and handed to the client UI. This keeps the offered tokens identical to what
// /api/v1/invoices accepts, and the server-rendered HTML identical to the first client render.
export const dynamic = "force-dynamic"

function tokenOptionsByChain(): Partial<Record<ChainKey, string[]>> {
  const out: Partial<Record<ChainKey, string[]>> = {}
  for (const chain of Object.keys(CHAIN_CONFIG) as ChainKey[]) {
    out[chain] = listTokenOptions(chain)
  }
  return out
}

export default function BillingPage() {
  return <BillingContent allowedTokens={tokenOptionsByChain()} />
}

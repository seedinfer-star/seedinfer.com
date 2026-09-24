export const dynamic = "force-dynamic"
export const revalidate = 0

import { pageMetadata } from "@/lib/catalog"
import PortalContent from "./portal-content"

export const metadata = pageMetadata(
  "Provider Portal",
  "Check your SeedInfer node's status by public key, register your USDC payout wallet on Base and see how provider earnings are calculated.",
  "/provider/portal",
)

export default function ProviderPortalPage() {
  return <PortalContent />
}

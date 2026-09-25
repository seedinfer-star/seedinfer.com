export const dynamic = "force-dynamic"
export const revalidate = 0

import { pageMetadata } from "@/lib/catalog"
import PortalContent from "./portal-content"

export const metadata = pageMetadata(
  "Provider Portal",
  "Manage your SeedInfer provider account: create node tokens, monitor your nodes and register your USDC payout wallet on Base.",
  "/provider/portal",
)

export default function ProviderPortalPage() {
  return <PortalContent />
}

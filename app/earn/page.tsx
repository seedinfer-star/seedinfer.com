export const dynamic = "force-dynamic"
export const revalidate = 0

import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Earn", "Estimate provider earnings on SeedInfer: 99% of token revenue plus a $0.40/day standby retainer, paid monthly in USDC on Base.", "/earn")

import EarnContent from "./earn-content"

export default function EarnPage() {
  return <EarnContent />
}

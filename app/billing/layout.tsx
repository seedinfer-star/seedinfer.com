import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Billing", "Add SeedInfer credits with USDC or native tokens and view subscription plans.", "/billing")

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

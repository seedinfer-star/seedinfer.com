import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Settings", "SeedInfer account settings and API configuration.", "/settings")

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

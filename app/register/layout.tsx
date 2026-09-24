import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Register", "Create a SeedInfer account.", "/register")

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

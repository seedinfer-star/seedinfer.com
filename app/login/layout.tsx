import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Sign in", "Sign in to your SeedInfer account.", "/login")

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

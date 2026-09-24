import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("API Console", "Test the SeedInfer OpenAI-compatible API at https://seedinfer.com/v1 and copy code snippets.", "/api-console")

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

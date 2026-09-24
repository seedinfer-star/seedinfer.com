import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata('Chat', "Try SeedInfer's OpenAI-compatible inference API in the browser.", "/chat")

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

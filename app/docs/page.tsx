export const dynamic = "force-dynamic"
export const revalidate = 0

import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Docs", "SeedInfer documentation: OpenAI-compatible API at https://seedinfer.com/v1 and provider node setup.", "/docs")

import DocsContent from "./docs-content"

export default function DocsPage() {
  return <DocsContent />
}

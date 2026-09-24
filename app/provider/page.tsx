export const dynamic = "force-dynamic"
export const revalidate = 0

import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Become a Provider", "Run a SeedInfer GPU node (NVIDIA, 32GB+ VRAM) and earn 99% of the token revenue it serves.", "/provider")

import ProviderContent from "./provider-content"

export default function ProviderPage() {
  return <ProviderContent />
}

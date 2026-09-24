import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/catalog"

export const metadata = pageMetadata("Models", "Models and per-token pricing on SeedInfer: Gemma 4 26B A4B NVFP4 live, Nemotron 3.5 Lightning and Qwen 3.6 coming soon.", "/models")

export default function Layout({ children }: { children: ReactNode }) {
  return children
}

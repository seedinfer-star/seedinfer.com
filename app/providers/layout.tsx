import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Providers",
  description: "Live registry of SeedInfer GPU provider nodes and a one-command installer to join the network.",
  alternates: { canonical: "/providers" },
}

export default function ProvidersLayout({ children }: { children: React.ReactNode }) {
  return children
}

import type { Metadata } from "next"
import StatsDashboard from "@/components/stats-dashboard"

export const metadata: Metadata = {
  title: "Network stats",
  description: "Live SeedInfer network statistics: nodes online, token throughput, provider locations and fleet.",
  alternates: { canonical: "/stats" },
}

export default function StatsPage() {
  return <StatsDashboard />
}

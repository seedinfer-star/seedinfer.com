import Link from "next/link"
import AppShell from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Server } from "lucide-react"
import { pageMetadata, REVENUE_SHARE_PCT, PAYOUT_LABEL } from "@/lib/catalog"

export const metadata = pageMetadata(
  "Leaderboard",
  "Provider leaderboard for the SeedInfer GPU inference network — coming soon.",
  "/leaderboard",
)

export default function LeaderboardPage() {
  return (
    <AppShell>
        <header className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-border-dim bg-bg-secondary/60 px-4 py-2 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-text-primary">Leaderboard</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">Top providers by served tokens and earnings</p>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            Coming soon
          </Badge>
        </header>

        <main id="main" className="flex-1 bg-bg-primary md:min-h-0 md:overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
            <Card className="border border-border-dim bg-bg-secondary">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent-brand/20 bg-accent-brand/10">
                  <Trophy className="h-6 w-6 text-accent-brand" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">The provider leaderboard is coming soon</h2>
                <p className="max-w-lg text-sm leading-6 text-text-secondary">
                  Once enough nodes are live, this page will rank providers by served tokens and earnings over the last 7 days. Providers earn{" "}
                  {REVENUE_SHARE_PCT}% of token revenue; payouts: {PAYOUT_LABEL}.
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Link
                    href="/provider"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-brand-hover"
                  >
                    <Server className="h-3.5 w-3.5" /> Become a provider
                  </Link>
                  <Link
                    href="/providers"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                  >
                    View live fleet
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
    </AppShell>
  )
}

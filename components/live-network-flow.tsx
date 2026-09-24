"use client"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ProviderLocation } from "@/lib/types"

const Map = dynamic(() => import("./map"), { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-bg-tertiary" /> })

type Props = {
  locations: ProviderLocation[]
  regions: ProviderLocation[]
}

export default function LiveNetworkFlow({ locations, regions }: Props) {
  const top = [...locations].sort((a, b) => b.providers - a.providers).slice(0, 12)
  const topRegions = [...regions].sort((a, b) => b.providers - a.providers).slice(0, 8)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-tight text-text-primary">Live Network Flow</h2>
        <Badge variant="success" className="font-mono text-[10px] uppercase tracking-wide">
          <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green" />
          Live · MapLibre
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden border border-border-dim bg-bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              Global provider map — {locations.length} cities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <Map locations={locations} height={360} />
            <p className="mt-2 font-mono text-[10px] text-text-tertiary">
              MapLibre GL · dots sized by providers
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="border border-border-dim bg-bg-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                Top regions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 p-3 pt-0">
              {topRegions.map((r) => (
                <div key={r.key} className="flex items-center justify-between rounded-lg border border-border-dim bg-bg-tertiary/60 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-text-primary">
                      {r.region ?? r.country} <span className="font-mono text-[10px] text-text-tertiary">{r.country_code}</span>
                    </div>
                    <div className="font-mono text-[10px] text-text-tertiary">
                      {r.providers} nodes · {r.hardware_attested} attested · {r.memory_gb} GB
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0 border-border-dim bg-bg-secondary font-mono text-[10px]">
                    {r.providers}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-border-dim bg-bg-secondary">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                Provider locations (city tiles)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {top.map((loc) => (
                  <div key={loc.key} className="rounded-lg border border-border-dim bg-bg-tertiary/50 p-2.5">
                    <div className="truncate text-xs font-medium text-text-primary">
                      {loc.city ?? loc.region}, {loc.country_code}
                    </div>
                    <div className="font-mono text-[10px] text-text-tertiary">
                      {loc.region ?? ""} · {loc.providers} providers
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-text-secondary">
                        {loc.gpu_cores} GPU cores
                      </span>
                      <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-text-secondary">
                        {loc.memory_gb} GB
                      </span>
                      <span className="rounded-full bg-accent-green/10 px-1.5 py-0.5 font-mono text-[9px] text-accent-green">
                        {loc.hardware_attested} ✓
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

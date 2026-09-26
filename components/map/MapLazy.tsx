"use client"
import dynamic from "next/dynamic"
import type { ProviderLocation } from "@/lib/types"

type Props = {
  locations: ProviderLocation[]
  height?: number
}

function Skeleton({ height = 360 }: { height?: number }) {
  return <div className="skeleton rounded-xl" style={{ height }} />
}

const MapCoreDynamic = dynamic(() => import("./MapCore"), {
  ssr: false,
  loading: () => <Skeleton height={360} />,
})

export default function MapLazy({ locations, height = 360 }: Props) {
  if (locations.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center rounded-xl border border-dashed border-border-dim bg-bg-tertiary p-4 text-center text-xs text-text-tertiary"
      >
        No provider locations reported yet.
      </div>
    )
  }
  return <MapCoreDynamic locations={locations} height={height} />
}

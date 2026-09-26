"use client"
import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import type { ProviderLocation } from "@/lib/types"
import { useTheme } from "@/components/theme-provider"
import MapEmpty from "./MapEmpty"
import { STYLES, addProviderLayer, toGeoJson } from "./map-style"

type Props = {
  locations: ProviderLocation[]
  height?: number
}

export default function MapCore({ locations, height = 360 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const locationsRef = useRef(locations)
  const styleRef = useRef<keyof typeof STYLES | null>(null)
  const { theme, mounted } = useTheme()
  const [unavailable, setUnavailable] = useState(false)

  locationsRef.current = locations

  // create once (after the theme is known, to avoid loading the wrong basemap)
  useEffect(() => {
    if (!mounted || !ref.current || mapRef.current) return
    const initial = theme === "light" ? "light" : "dark"
    styleRef.current = initial
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: STYLES[initial],
        center: [15, 30],
        zoom: 1.2,
        attributionControl: false,
        cooperativeGestures: true,
      })
    } catch {
      // WebGL disabled/unavailable (some browsers, remote desktops): show the list-only fallback.
      setUnavailable(true)
      return
    }
    map.on("error", () => {}) // tile/style hiccups must not surface as page errors
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right")
    // (re)add our layers every time a basemap style finishes loading
    map.on("style.load", () => addProviderLayer(map, locationsRef.current))
    mapRef.current = map

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(ref.current)

    return () => {
      ro.disconnect()
      try {
        map.remove()
      } catch {}
      mapRef.current = null
      styleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  // react to theme changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mounted) return
    const next = theme === "light" ? "light" : "dark"
    if (styleRef.current === next) return
    styleRef.current = next
    // full reload so "style.load" fires and our provider layers are re-added
    map.setStyle(STYLES[next], { diff: false })
  }, [theme, mounted])

  // update data when locations change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource("providers") as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(toGeoJson(locations))
  }, [locations])

  if (unavailable) {
    return <MapEmpty height={height} />
  }

  return (
    <div
      ref={ref}
      style={{ height }}
      role="img"
      aria-label={`Map of ${locations.length} provider locations`}
      className="w-full overflow-hidden rounded-xl border border-border-dim bg-bg-tertiary"
    />
  )
}

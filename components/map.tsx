"use client"
import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import type { ProviderLocation } from "@/lib/types"
import { useTheme } from "@/components/theme-provider"

type Props = {
  locations: ProviderLocation[]
  height?: number
}

const STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const

/** Read a channel-style CSS token ("99 102 241") as a MapLibre-compatible colour. */
function tokenColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  const parts = raw.split(/[\s,]+/).filter(Boolean)
  return parts.length >= 3 ? `rgb(${parts.slice(0, 3).join(", ")})` : fallback
}

function toGeoJson(locations: ProviderLocation[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: locations
      .filter((l) => Number.isFinite(l.longitude) && Number.isFinite(l.latitude))
      .slice(0, 300)
      .map((loc) => ({
        type: "Feature",
        properties: { providers: loc.providers, city: loc.city ?? loc.region ?? loc.country, country: loc.country },
        geometry: { type: "Point", coordinates: [loc.longitude, loc.latitude] },
      })),
  }
}

function addProviderLayer(map: maplibregl.Map, locations: ProviderLocation[]) {
  if (map.getSource("providers")) return
  const brand = tokenColor("--accent-brand", "#6366f1")
  const ring = tokenColor("--bg-secondary", "#111113")
  map.addSource("providers", { type: "geojson", data: toGeoJson(locations) })
  map.addLayer({
    id: "providers-glow",
    type: "circle",
    source: "providers",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "providers"], 1, 10, 10, 16, 30, 26],
      "circle-color": brand,
      "circle-opacity": 0.18,
      "circle-blur": 0.6,
    },
  })
  map.addLayer({
    id: "providers-circle",
    type: "circle",
    source: "providers",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "providers"], 1, 4, 10, 8, 30, 14],
      "circle-color": brand,
      "circle-opacity": 0.9,
      "circle-stroke-color": ring,
      "circle-stroke-width": 1.5,
    },
  })
}

export default function Map({ locations, height = 360 }: Props) {
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
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center rounded-xl border border-dashed border-border-dim bg-bg-tertiary p-4 text-center text-xs text-text-tertiary"
      >
        Interactive map unavailable in this browser (WebGL disabled). Provider countries are listed below.
      </div>
    )
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

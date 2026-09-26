import type maplibregl from "maplibre-gl"
import type { ProviderLocation } from "@/lib/types"

export const STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const

export type MapStyleKey = keyof typeof STYLES

/** Read a channel-style CSS token ("99 102 241") as a MapLibre-compatible colour. */
export function tokenColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  const parts = raw.split(/[\s,]+/).filter(Boolean)
  return parts.length >= 3 ? `rgb(${parts.slice(0, 3).join(", ")})` : fallback
}

export function toGeoJson(locations: ProviderLocation[]): GeoJSON.FeatureCollection {
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

export function addProviderLayer(map: maplibregl.Map, locations: ProviderLocation[]) {
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

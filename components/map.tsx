"use client"
import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import type { ProviderLocation } from "@/lib/types"

type Props = {
  locations: ProviderLocation[]
  height?: number
}

export default function Map({ locations, height = 360 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" as any,
      center: [20, 30],
      zoom: 1.3,
      attributionControl: false,
    } as any)
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right")
    mapRef.current = map

    map.on("load", () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: locations.slice(0, 200).map((loc) => ({
          type: "Feature",
          properties: { providers: loc.providers, city: loc.city ?? loc.region ?? loc.country, country: loc.country },
          geometry: { type: "Point", coordinates: [loc.longitude, loc.latitude] },
        })),
      }
      if (!map.getSource("providers")) {
        map.addSource("providers", { type: "geojson", data: geojson })
        map.addLayer({
          id: "providers-circle",
          type: "circle",
          source: "providers",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "providers"], 2, 4, 10, 8, 30, 14],
            "circle-color": "#818cf8",
            "circle-opacity": 0.85,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
          },
        })
      }
    })

    return () => {
      try {
        map.remove()
      } catch {}
      mapRef.current = null
    }
  }, [locations])

  // update source when locations change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src: any = map.getSource("providers")
    if (src) {
      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: locations.slice(0, 300).map((loc) => ({
          type: "Feature",
          properties: { providers: loc.providers },
          geometry: { type: "Point", coordinates: [loc.longitude, loc.latitude] },
        })),
      }
      src.setData(geojson)
    }
  }, [locations])

  return (
    <div
      ref={ref}
      style={{ height }}
      className="w-full overflow-hidden rounded-xl border border-border-dim bg-bg-tertiary"
    />
  )
}

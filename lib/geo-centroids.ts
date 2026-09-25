/**
 * lib/geo-centroids.ts — approximate country centroids for the public provider map.
 * The map is deliberately country-level: a node's position is the centroid of the country
 * Cloudflare reports for its heartbeat (CF-IPCountry), never its IP or city.
 */
export const COUNTRY_CENTROIDS: Record<string, { name: string; lat: number; lon: number }> = {
  PL: { name: "Poland", lat: 52.1, lon: 19.4 },
  DE: { name: "Germany", lat: 51.1, lon: 10.4 },
  NL: { name: "Netherlands", lat: 52.2, lon: 5.3 },
  BE: { name: "Belgium", lat: 50.6, lon: 4.6 },
  FR: { name: "France", lat: 46.6, lon: 2.4 },
  GB: { name: "United Kingdom", lat: 54.0, lon: -2.5 },
  IE: { name: "Ireland", lat: 53.2, lon: -8.2 },
  ES: { name: "Spain", lat: 40.2, lon: -3.6 },
  PT: { name: "Portugal", lat: 39.6, lon: -8.0 },
  IT: { name: "Italy", lat: 42.8, lon: 12.6 },
  CH: { name: "Switzerland", lat: 46.8, lon: 8.2 },
  AT: { name: "Austria", lat: 47.6, lon: 14.1 },
  CZ: { name: "Czechia", lat: 49.8, lon: 15.5 },
  SK: { name: "Slovakia", lat: 48.7, lon: 19.7 },
  HU: { name: "Hungary", lat: 47.2, lon: 19.4 },
  RO: { name: "Romania", lat: 45.9, lon: 25.0 },
  BG: { name: "Bulgaria", lat: 42.7, lon: 25.3 },
  GR: { name: "Greece", lat: 39.1, lon: 22.0 },
  HR: { name: "Croatia", lat: 45.1, lon: 15.2 },
  SI: { name: "Slovenia", lat: 46.1, lon: 14.8 },
  RS: { name: "Serbia", lat: 44.0, lon: 20.9 },
  UA: { name: "Ukraine", lat: 49.0, lon: 31.4 },
  LT: { name: "Lithuania", lat: 55.3, lon: 23.9 },
  LV: { name: "Latvia", lat: 56.9, lon: 24.6 },
  EE: { name: "Estonia", lat: 58.6, lon: 25.0 },
  FI: { name: "Finland", lat: 64.5, lon: 26.0 },
  SE: { name: "Sweden", lat: 62.0, lon: 15.0 },
  NO: { name: "Norway", lat: 61.4, lon: 8.8 },
  DK: { name: "Denmark", lat: 56.0, lon: 10.0 },
  IS: { name: "Iceland", lat: 64.9, lon: -18.6 },
  TR: { name: "Türkiye", lat: 39.0, lon: 35.2 },
  IL: { name: "Israel", lat: 31.4, lon: 35.0 },
  AE: { name: "United Arab Emirates", lat: 23.9, lon: 54.3 },
  SA: { name: "Saudi Arabia", lat: 24.0, lon: 45.1 },
  IN: { name: "India", lat: 22.9, lon: 79.6 },
  SG: { name: "Singapore", lat: 1.35, lon: 103.8 },
  JP: { name: "Japan", lat: 36.2, lon: 138.3 },
  KR: { name: "South Korea", lat: 36.4, lon: 127.9 },
  TW: { name: "Taiwan", lat: 23.7, lon: 121.0 },
  HK: { name: "Hong Kong", lat: 22.35, lon: 114.1 },
  CN: { name: "China", lat: 35.0, lon: 103.8 },
  VN: { name: "Vietnam", lat: 16.0, lon: 107.8 },
  TH: { name: "Thailand", lat: 15.1, lon: 101.0 },
  ID: { name: "Indonesia", lat: -2.5, lon: 118.0 },
  MY: { name: "Malaysia", lat: 3.8, lon: 102.0 },
  PH: { name: "Philippines", lat: 12.9, lon: 122.8 },
  AU: { name: "Australia", lat: -25.7, lon: 134.5 },
  NZ: { name: "New Zealand", lat: -41.8, lon: 172.8 },
  US: { name: "United States", lat: 39.8, lon: -98.6 },
  CA: { name: "Canada", lat: 56.1, lon: -106.3 },
  MX: { name: "Mexico", lat: 23.6, lon: -102.5 },
  BR: { name: "Brazil", lat: -10.8, lon: -52.9 },
  AR: { name: "Argentina", lat: -35.4, lon: -65.2 },
  CL: { name: "Chile", lat: -35.7, lon: -71.5 },
  CO: { name: "Colombia", lat: 4.1, lon: -72.9 },
  ZA: { name: "South Africa", lat: -29.0, lon: 25.1 },
  NG: { name: "Nigeria", lat: 9.6, lon: 8.1 },
  EG: { name: "Egypt", lat: 26.5, lon: 29.9 },
  KE: { name: "Kenya", lat: 0.2, lon: 37.9 },
}

/** Validate a 2-letter country code from Cloudflare/heartbeat (XX = unknown, T1 = Tor). */
export function normalizeCountryCode(v: unknown): string | undefined {
  const cc = typeof v === "string" ? v.trim().toUpperCase() : ""
  if (!/^[A-Z]{2}$/.test(cc) || cc === "XX" || cc === "T1") return undefined
  return cc
}

export function compact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000) return (n / 1000).toFixed(1) + "K"
  return String(n)
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K"
  return n.toLocaleString("en-US")
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US")
}

export function formatBytesGb(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + " TB"
  return n.toLocaleString() + " GB"
}

export function formatWatts(w: number): string {
  if (w >= 1000) return (w / 1000).toFixed(1) + " kW"
  return w.toLocaleString() + " W"
}

export function formatPercent(v: number, digits = 1): string {
  return (v * 100).toFixed(digits) + "%"
}

export function formatTps(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " tok/s"
}

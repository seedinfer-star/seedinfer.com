/**
 * lib/stats-normalize.ts — client-safe model-id normalization for stats payloads.
 * Maps reported model ids / aliases / HF ids to catalog ids and hides routing-only aliases.
 */
import { LIVE_MODEL, HIDDEN_ROUTING_ALIASES, findModel } from "./catalog"

/** Map any reported model id to its public catalog id (or null to hide it). */
export function publicModelId(id: string | null | undefined): string | null {
  if (!id) return null
  const s = String(id)
  if (HIDDEN_ROUTING_ALIASES[s]) return HIDDEN_ROUTING_ALIASES[s]
  if (s.startsWith("/")) return null // local path — never public
  const m = findModel(s)
  if (m) return m.id
  const byHf = findModel(s.split("/").pop())
  if (byHf) return byHf.id
  const lower = s.toLowerCase()
  if (lower.includes("gemma-4") || lower.includes("gemma4")) return LIVE_MODEL.id
  return s
}

/** Normalize models / provider model ids in a stats payload. When `liveOnly`, keep only live catalog models. */
export function normalizeStats(data: any, liveOnly = false): any {
  if (!data || typeof data !== "object") return data
  try {
    if (Array.isArray(data.models)) {
      const merged = new Map<string, number>()
      for (const m of data.models) {
        const id = publicModelId(m?.id)
        if (!id) continue
        if (liveOnly && findModel(id)?.status !== "live") continue
        merged.set(id, (merged.get(id) || 0) + (Number(m?.providers) || 0))
      }
      if (merged.size === 0) merged.set(LIVE_MODEL.id, 0)
      data.models = Array.from(merged.entries()).map(([id, providers]) => ({ id, providers }))
    }
    if (data.network_utilization && typeof data.network_utilization.bottleneck_model === "string") {
      data.network_utilization.bottleneck_model = publicModelId(data.network_utilization.bottleneck_model) || LIVE_MODEL.id
    }
    if (Array.isArray(data.providers)) {
      data.providers = data.providers.map((p: any) => {
        if (!p || typeof p !== "object") return p
        if (typeof p.current_model === "string") p.current_model = publicModelId(p.current_model) || "custom"
        if (Array.isArray(p.models)) p.models = Array.from(new Set(p.models.map((x: string) => publicModelId(x) || "custom")))
        return p
      })
    }
  } catch {}
  return data
}


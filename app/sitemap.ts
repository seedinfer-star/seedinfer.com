import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/catalog"

const ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/models", priority: 0.9, changeFrequency: "weekly" },
  { path: "/docs", priority: 0.9, changeFrequency: "weekly" },
  { path: "/provider", priority: 0.8, changeFrequency: "weekly" },
  { path: "/stats", priority: 0.7, changeFrequency: "hourly" },
  { path: "/providers", priority: 0.7, changeFrequency: "hourly" },
  { path: "/earn", priority: 0.6, changeFrequency: "weekly" },
  { path: "/leaderboard", priority: 0.5, changeFrequency: "daily" },
  { path: "/chat", priority: 0.6, changeFrequency: "weekly" },
  { path: "/api-console", priority: 0.5, changeFrequency: "weekly" },
  { path: "/register", priority: 0.5, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "monthly" },
  { path: "/provider/portal", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path === "/" ? "" : r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}

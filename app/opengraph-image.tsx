import { ImageResponse } from "next/og"
import { LIVE_MODEL, REVENUE_SHARE_PCT, priceLabel } from "@/lib/catalog"

export const alt = "SeedInfer — AI inference at the price of electricity"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

function Mark({ size: s }: { size: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <path d="M16 6.5c-5.2 3.1-8.2 7.4-8.2 12a8.2 8.2 0 0 0 16.4 0c0-4.6-3-8.9-8.2-12z" fill="#fff" />
      <path d="M16 13.5v11.2M16 19.2l3.2-2.6" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 85% 0%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 0% 100%, rgba(99,102,241,0.12), transparent 50%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Mark size={64} />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>SeedInfer</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            AI inference at the price of electricity
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#a1a1aa", maxWidth: 980 }}>
            {`OpenAI-compatible API on verified NVIDIA GPUs · providers keep ${REVENUE_SHARE_PCT}%`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24, color: "#a1a1aa" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid #27272a",
              background: "#111113",
              color: "#fafafa",
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#10b981" }} />
            <div style={{ display: "flex" }}>{LIVE_MODEL.name}</div>
          </div>
          <div style={{ display: "flex" }}>
            {`${priceLabel(LIVE_MODEL)} per 1M tokens · seedinfer.com`}
          </div>
        </div>
      </div>
    ),
    size,
  )
}

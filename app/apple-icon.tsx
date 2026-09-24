import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#4f46e5" }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <rect width="32" height="32" fill="#4f46e5" />
          <path d="M16 6.5c-5.2 3.1-8.2 7.4-8.2 12a8.2 8.2 0 0 0 16.4 0c0-4.6-3-8.9-8.2-12z" fill="#fff" />
          <path d="M16 13.5v11.2M16 19.2l3.2-2.6" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    size,
  )
}

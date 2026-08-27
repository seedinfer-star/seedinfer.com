import "./globals.css"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://seedinfer.com"),
  title: "SeedInfer — Private AI on Verified Hardware · Network Stats",
  description:
    "SeedInfer private inference on verified RTX 5090 providers. Real-time network stats, token throughput, provider fleet.",
  openGraph: {
    title: "SeedInfer — Network Stats",
    description: "Private AI on verified hardware · Live network metrics",
    url: "https://seedinfer.com/stats",
    siteName: "SeedInfer",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-bg-primary font-sans antialiased text-text-primary">{children}</body>
    </html>
  )
}

import "./globals.css"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  display: "swap",
})

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
    <html lang="en" className={`dark ${jakarta.variable} ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('seedinfer_theme');
                  var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (t === 'light' || (!t && !d)) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg-primary font-sans antialiased text-text-primary selection:bg-accent-brand/20">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}


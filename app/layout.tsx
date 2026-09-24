import "maplibre-gl/dist/maplibre-gl.css"
import "./globals.css"
import type { Metadata, Viewport } from "next"
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

const DEFAULT_TITLE = "SeedInfer — AI inference at the price of electricity"
const DESCRIPTION =
  "Decentralized, OpenAI-compatible AI inference on verified NVIDIA GPUs at near-electricity cost. Providers keep 99% of revenue."

export const metadata: Metadata = {
  metadataBase: new URL("https://seedinfer.com"),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · SeedInfer",
  },
  description: DESCRIPTION,
  applicationName: "SeedInfer",
  keywords: [
    "AI inference",
    "LLM API",
    "OpenAI-compatible API",
    "decentralized GPU",
    "P2P inference",
    "Gemma 4",
    "NVFP4",
    "GPU provider",
    "RTX 5090",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "SeedInfer",
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
}

// Dark-first: only switch to light when the user explicitly chose it.
const NO_FLASH_THEME = `(function(){try{var t=localStorage.getItem('seedinfer_theme');var r=document.documentElement;if(t==='light'){r.classList.remove('dark');r.classList.add('light');}else{r.classList.add('dark');r.classList.remove('light');}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${jakarta.variable} ${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
      </head>
      <body className="min-h-screen bg-bg-primary font-sans text-text-primary antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-accent-brand focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

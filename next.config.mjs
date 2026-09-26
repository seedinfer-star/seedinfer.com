/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Light for Orange Pi RK3588: trim barrel-import cost, no extra RAM/CPU.
    optimizePackageImports: ["recharts", "lucide-react", "maplibre-gl"],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  async rewrites() {
    return [
      {
        source: "/v1/models",
        destination: "/api/v1/models",
      },
      {
        source: "/v1/chat/completions",
        destination: "/api/v1/chat/completions",
      },
      {
        source: "/api/stats",
        destination: "/api/stats",
      },
      {
        source: "/provider.tar.gz",
        destination: "/api/provider-archive",
      },
      {
        source: "/provider-image.tar.gz",
        destination: "/api/provider-image",
      },
      {
        source: "/api/install",
        destination: "/install.sh",
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/install.sh",
        headers: [
          { key: "Content-Type", value: "text/x-shellscript; charset=utf-8" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/provider",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/docs",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/earn",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ]
  },
}
export default nextConfig

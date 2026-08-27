/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
        source: "/provider.tar.gz",
        headers: [
          { key: "Content-Type", value: "application/gzip" },
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/provider-image.tar.gz",
        headers: [
          { key: "Content-Type", value: "application/gzip" },
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
          { key: "Content-Disposition", value: 'attachment; filename="provider-image.tar.gz"' },
        ],
      },
    ]
  },
}
export default nextConfig

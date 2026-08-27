import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function HEAD() {
  return GET()
}

export async function GET() {
  // Resolve provider/scripts/install.sh relative to cwd (works both dev and Docker /app)
  const candidates = [
    path.join(process.cwd(), "provider/scripts/install.sh"),
    path.join(process.cwd(), "provider", "scripts", "install.sh"),
    path.join(path.dirname(process.cwd()), "provider/scripts/install.sh"),
  ]
  let content: string | null = null
  let resolvedPath: string | null = null
  for (const p of candidates) {
    try {
      content = await readFile(p, "utf-8")
      resolvedPath = p
      break
    } catch {}
  }

  // Fallback: generate minimal shim if file missing (should not happen in prod where COPY . .)
  if (!content) {
    content = `#!/usr/bin/env bash
# SeedInfer Provider — fallback install.sh (file missing in image)
echo "SeedInfer install.sh not found in image — cloning from GitHub"
set -euo pipefail
GATEWAY="https://seedinfer.com"
LOGIN_SERVER="https://tailnet.seedinfer.com"
echo "Use: curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey hskey-xxx"
echo "Fallback: git clone https://github.com/seedinfer/seedinfer.com.git /opt/seedinfer-provider"
`
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/x-shellscript; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Content-Disposition": 'inline; filename="install.sh"',
    "X-Content-Type-Options": "nosniff",
    ...CORS_HEADERS,
  }

  // Add ETag-like hint for debugging
  if (resolvedPath) {
    headers["X-SeedInfer-Source"] = resolvedPath.replace(process.cwd(), "")
  }

  return new NextResponse(content, { status: 200, headers })
}

import { NextResponse, NextRequest } from "next/server"
import path from "path"
import { existsSync, statSync, createReadStream } from "fs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Serve provider-image.tar.gz — prebuilt CUDA image (ghcr fallback hosted on Pi /opt/seedinfer/public)
// Sources (checked in order):
//   1) /opt/seedinfer/public/provider-image.tar.gz (Pi prod)
//   2) /opt/seedinfer/public/provider/provider-image.tar.gz (Pi alt)
//   3) <cwd>/public/provider-image.tar.gz (dev)
//   4) <cwd>/public/provider/provider-image.tar.gz (dev)
//   5) /tmp/provider-image.tar.gz (host build tmp)
function findTar(): string | null {
  const candidates = [
    "/opt/seedinfer/public/provider-image.tar.gz",
    "/opt/seedinfer/public/provider/provider-image.tar.gz",
    path.join(process.cwd(), "public", "provider-image.tar.gz"),
    path.join(process.cwd(), "public", "provider", "provider-image.tar.gz"),
    "/tmp/provider-image.tar.gz",
    path.join(process.cwd(), "provider-image.tar.gz"),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p) && statSync(p).isFile() && statSync(p).size > 1024) return p
    } catch {}
  }
  return null
}

export async function HEAD() {
  return GET({} as any)
}

export async function GET(req: NextRequest) {
  const tarPath = findTar()
  if (!tarPath) {
    return NextResponse.json(
      {
        error: "provider-image.tar.gz not available",
        hint: "Prebuild image not yet published. Run on host 5090: ./scripts/publish-provider-image.sh --push --rsync-pi, or fallback to local build: SEEDINFER_SKIP_PREBUILD=1 curl -fsSL https://seedinfer.com/install.sh | bash",
        expected: "/opt/seedinfer/public/provider-image.tar.gz (Pi) -> https://seedinfer.com/provider-image.tar.gz",
        build: "docker build -f provider/Dockerfile.cuda -t ghcr.io/seedinfer/provider:cuda13.3-nvfp4 . && docker save ghcr.io/seedinfer/provider:cuda13.3-nvfp4 | gzip > /tmp/provider-image.tar.gz",
      },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  try {
    const stat = statSync(tarPath)
    const range = req.headers.get("range")

    // Support Range requests for resumable curl (e.g., curl -C -)
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/)
      if (m) {
        const start = parseInt(m[1], 10)
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1
        const chunkSize = end - start + 1
        const stream: any = createReadStream(tarPath, { start, end })
        return new NextResponse(stream as any, {
          status: 206,
          headers: {
            "Content-Type": "application/gzip",
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Disposition": 'attachment; filename="provider-image.tar.gz"',
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            "X-SeedInfer-Source": tarPath.replace(process.cwd(), ""),
            "X-SeedInfer-Size": String(stat.size),
            ...CORS_HEADERS,
          },
        })
      }
    }

    // Full file streaming (not buffering into memory — critical for 10-15GB)
    const stream: any = createReadStream(tarPath)
    // For Next.js, returning a stream works with Node runtime
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(stat.size),
        "Content-Disposition": 'attachment; filename="provider-image.tar.gz"',
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-SeedInfer-Source": tarPath.replace(process.cwd(), ""),
        "X-SeedInfer-Size": String(stat.size),
        "Accept-Ranges": "bytes",
        ...CORS_HEADERS,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `failed to serve tar: ${e?.message || e}` },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

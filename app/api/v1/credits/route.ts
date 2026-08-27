import { NextResponse } from "next/server";
import { extractJwtFromRequest, verifySession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/v1/credits — live balance (auth required)
export async function GET(req: Request) {
  const jwt = extractJwtFromRequest(req as any);
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized — missing JWT (cookie or Bearer)" }, { status: 401, headers: CORS_HEADERS });
  }
  const sess = await verifySession(jwt);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized — invalid or expired session" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const db = getDb();
    let row: any = null;
    try {
      row = db.prepare("SELECT balance_usd_cents FROM credits WHERE user_id = ?").get(String(sess.userId)) as any;
    } catch (e: any) {
      // fallback: if prepare fails, return 0 with warning
      console.warn(`[api/credits] query failed: ${e?.message}`);
    }
    const balance_usd_cents = row && typeof row.balance_usd_cents === "number" ? row.balance_usd_cents : row?.balance_usd_cents != null ? Number(row.balance_usd_cents) : 0;
    const cents = Number.isFinite(balance_usd_cents) ? Math.floor(balance_usd_cents) : 0;
    return NextResponse.json(
      {
        ok: true,
        balance_usd_cents: cents,
        balance_usd: cents / 100,
        user_id: sess.userId,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "credits query failed" }, { status: 500, headers: CORS_HEADERS });
  }
}

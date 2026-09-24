import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { extractJwtFromRequest, verifySession } from "@/lib/auth";

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

export async function GET(req: Request) {
  const jwt = extractJwtFromRequest(req as any);
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized — missing JWT" }, { status: 401, headers: CORS_HEADERS });
  }
  const sess = await verifySession(jwt);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized — missing JWT" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const db = getDb();
    const userRow = db
      .prepare("SELECT id, email, avatar_url, email_verified FROM users WHERE id = ?")
      .get(String(sess.userId)) as
      | { id: string; email: string; avatar_url: string | null; email_verified: number | null }
      | undefined;

    if (!userRow) {
      return NextResponse.json({ error: "user not found" }, { status: 404, headers: CORS_HEADERS });
    }

    let creditRow: any = null;
    try {
      creditRow = db.prepare("SELECT balance_usd_cents FROM credits WHERE user_id = ?").get(String(sess.userId)) as any;
    } catch (e: any) {
      console.warn(`[api/auth/me] credits query failed: ${e?.message}`);
    }

    const balance_usd_cents =
      creditRow && typeof creditRow.balance_usd_cents === "number"
        ? creditRow.balance_usd_cents
        : creditRow?.balance_usd_cents != null
          ? Number(creditRow.balance_usd_cents)
          : 0;
    const cents = Number.isFinite(balance_usd_cents) ? Math.floor(Number(balance_usd_cents)) : 0;

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: userRow.id,
          email: userRow.email,
          avatar_url: userRow.avatar_url ?? null,
          email_verified: userRow.email_verified ?? 0,
        },
        credits: {
          balance_usd_cents: cents,
          balance_usd: cents / 100,
        },
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
    return NextResponse.json({ error: e?.message || "me query failed" }, { status: 500, headers: CORS_HEADERS });
  }
}

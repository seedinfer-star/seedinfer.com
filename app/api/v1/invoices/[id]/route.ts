import { NextResponse } from "next/server";
import { extractJwtFromRequest, verifySession } from "@/lib/auth";
import { getInvoiceById } from "@/lib/payments/invoice";
import { getExplorerTxUrl } from "@/lib/payments/chains";
import type { ChainKey } from "@/lib/payments/chains";

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

// GET /api/v1/invoices/:id — status polling (auth required, ownership check)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "missing invoice id" }, { status: 400, headers: CORS_HEADERS });
  }

  const jwt = extractJwtFromRequest(req as any);
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized — missing JWT" }, { status: 401, headers: CORS_HEADERS });
  }
  const sess = await verifySession(jwt);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized — invalid session" }, { status: 401, headers: CORS_HEADERS });
  }

  const invoice = getInvoiceById(String(id));
  if (!invoice) {
    return NextResponse.json({ error: "invoice not found" }, { status: 404, headers: CORS_HEADERS });
  }
  if (invoice.user_id !== sess.userId) {
    return NextResponse.json({ error: "forbidden — invoice belongs to different user" }, { status: 403, headers: CORS_HEADERS });
  }

  // Add explorer link if tx_hash present
  let explorer_tx_url: string | null = null;
  if (invoice.tx_hash) {
    try {
      explorer_tx_url = getExplorerTxUrl(invoice.chain as ChainKey, invoice.tx_hash);
    } catch {
      explorer_tx_url = null;
    }
  }

  // Hint for frontend polling interval
  const isPending = invoice.status === "pending" || invoice.status === "confirming";
  return NextResponse.json(
    {
      ok: true,
      invoice,
      explorer_tx_url,
      poll_hint: isPending ? "poll every 5s; worker confirms ~15s" : undefined,
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
}

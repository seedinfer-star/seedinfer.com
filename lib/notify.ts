/**
 * lib/notify.ts — optional outbound email via Resend HTTP API.
 * Never throws; when RESEND_API_KEY/MAIL_FROM are unset it is a no-op + console.info.
 */

export type NotifyOpts = { to: string; subject: string; text: string };

async function postWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal } as any);
  } finally {
    clearTimeout(t);
  }
}

/** Fire-and-forget email; always resolves (never rejects). */
export async function sendEmail(opts: NotifyOpts): Promise<boolean> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.MAIL_FROM || "").trim();
  if (!apiKey || !from) {
    console.info(`[notify] email skipped (no RESEND_API_KEY/MAIL_FROM): to=${opts.to} subject=${opts.subject}`);
    return false;
  }
  if (!opts.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opts.to)) return false;
  try {
    const res = await postWithTimeout(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
      },
      5000
    );
    if (!res.ok) {
      console.warn(`[notify] resend failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn(`[notify] send failed: ${e?.message || e}`);
    return false;
  }
}

/** Notify about a security-sensitive change without blocking the caller. */
export function notifySecurityChange(to: string | null | undefined, subject: string, text: string): void {
  if (!to) return;
  void sendEmail({ to, subject, text }).catch(() => {});
}

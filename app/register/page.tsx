"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Github, Chrome, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Invalid email");
      return;
    }
    if (!password || password.length < 8) {
      setErr("Password too short (min 8 chars)");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || `Registration failed (${res.status})`);
        setLoading(false);
        return;
      }
      router.push("/billing");
      router.refresh();
      setTimeout(() => {
        if (window.location.pathname === "/register") window.location.href = "/billing";
      }, 400);
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border-dim bg-bg-secondary px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-text-primary">Create account</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">SeedInfer — choose email/password or OAuth</p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Sign in
          </Link>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto flex max-w-[520px] flex-col gap-4 p-4 sm:p-6">
            {err && (
              <div className="flex items-start gap-2 rounded-xl border border-accent-red/20 bg-accent-red/10 px-3 py-2.5 text-xs leading-4 text-accent-red">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <UserPlus className="h-4 w-4 text-accent-brand" />
                  Create your account
                </CardTitle>
                <CardDescription>Registers via <code className="rounded bg-bg-tertiary px-1">POST /api/v1/auth/register</code> (jose HS256 + bcrypt). OAuth accounts are linked by email and stored in <code className="rounded bg-bg-tertiary px-1">oauth_accounts</code>.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <a
                    href="/api/auth/login/google"
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-tertiary px-4 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated"
                  >
                    <Chrome className="h-4 w-4" />
                    Continue with Google
                  </a>
                  <a
                    href="/api/auth/login/github"
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-tertiary px-4 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated"
                  >
                    <Github className="h-4 w-4" />
                    Continue with GitHub
                  </a>
                  <p className="font-mono text-[10px] leading-3 text-text-tertiary">
                    Element requires refinement — set GOOGLE_CLIENT_ID etc. OAuth callback upserts <code className="rounded bg-bg-tertiary px-1">users</code> + <code className="rounded bg-bg-tertiary px-1">oauth_accounts</code> + <code className="rounded bg-bg-tertiary px-1">credits</code> then signs <code className="rounded bg-bg-tertiary px-1">seedinfer_session</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border-dim" />
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">or</span>
                  <span className="h-px flex-1 bg-border-dim" />
                </div>

                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="font-mono text-[11px] font-medium text-text-secondary">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@seedinfer.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="font-mono text-[11px] font-medium text-text-secondary">
                      Password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="•••••••• (min 8 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="confirm" className="font-mono text-[11px] font-medium text-text-secondary">
                      Confirm password
                    </label>
                    <Input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="repeat password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creating…" : "Create account"}
                  </Button>

                  <p className="text-center font-mono text-xs text-text-tertiary">
                    Already have an account?{" "}
                    <Link href="/login" className="font-medium text-accent-brand hover:underline">
                      Sign in
                    </Link>{" "}
                    · <Link href="/billing" className="underline decoration-border-default hover:text-text-secondary">Back to billing</Link>
                  </p>
                </form>
              </CardContent>
            </Card>

            <p className="px-2 font-mono text-[10px] leading-4 text-text-tertiary">
              After registration you are signed in automatically (Set-Cookie <code className="rounded bg-bg-tertiary px-1">seedinfer_session</code>). Billing <code className="rounded bg-bg-tertiary px-1">GET /api/v1/credits</code> will then return your balance instead of 401. For RK3588 keep it light — no next-auth, direct jose + bcrypt.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

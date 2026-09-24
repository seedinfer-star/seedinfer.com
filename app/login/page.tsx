"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, Github, Chrome, AlertCircle } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(oauthError ? `OAuth error: ${oauthError}` : null);

  // Show banner if redirected from billing unauth or oauth failure
  const nextParam = searchParams.get("next") || "/billing";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email || !password) {
      setErr("Email and password required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || `Login failed (${res.status})`);
        setLoading(false);
        return;
      }
      // success: cookie set, redirect
      const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/billing";
      router.push(safeNext);
      router.refresh();
      // fallback hard navigation to ensure cookie applied for SSR billing
      setTimeout(() => {
        if (window.location.pathname === "/login") window.location.href = safeNext;
      }, 400);
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
        <header className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-border-dim bg-bg-secondary/60 px-4 py-2 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-text-primary">Sign in</h1>
            <p className="truncate font-mono text-[11px] text-text-tertiary">SeedInfer — P2P inference · billing requires JWT</p>
          </div>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Create account
          </Link>
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto flex max-w-[520px] flex-col gap-4 p-4 sm:p-6">
            {(err || oauthError) && (
              <div className="flex items-start gap-2 rounded-xl border border-accent-red/20 bg-accent-red/10 px-3 py-2.5 text-xs leading-4 text-accent-red">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err || `OAuth error: ${oauthError}`}</span>
              </div>
            )}

            <Card className="border border-border-dim bg-bg-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px]">
                  <LogIn className="h-4 w-4 text-accent-brand" />
                  Welcome back
                </CardTitle>
                <CardDescription>Sign in with email and password, or continue with Google or GitHub.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* OAuth buttons */}
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
                      autoComplete="current-password"
                      placeholder="•••••••• (min 8 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>

                  {err && !oauthError && <p className="rounded-lg bg-accent-red/10 px-2 py-1.5 font-mono text-xs text-accent-red">{err}</p>}

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>

                  <p className="text-center font-mono text-xs text-text-tertiary">
                    No account?{" "}
                    <Link href="/register" className="font-medium text-accent-brand hover:underline">
                      Create one
                    </Link>{" "}
                    · <Link href="/billing" className="underline decoration-border-default hover:text-text-secondary">Back to billing</Link>
                  </p>
                </form>
              </CardContent>
            </Card>

            <p className="px-2 font-mono text-[10px] leading-4 text-text-tertiary">
              Signing in lets you add credits and create invoices on the Billing page. <a href="/api/auth/logout" className="underline">Log out</a>
            </p>
          </div>
        </main>
    </AppShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main id="main" className="flex min-h-0 flex-1 items-center justify-center bg-bg-primary font-mono text-xs text-text-tertiary">
            Loading…
          </main>
        </AppShell>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

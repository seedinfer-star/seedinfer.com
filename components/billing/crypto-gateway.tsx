"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CHAIN_CONFIG, getExplorerAddressUrl, getExplorerTxUrl, type ChainKey } from "@/lib/payments/chains";
import { listAllowedSymbols } from "@/lib/payments/tokens";
import {
  Wallet,
  Copy,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  QrCode,
  Coins,
  Timer,
  Send,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PRESETS = [
  { cents: 100, label: "$1", tier: "GO (3x)", note: "$3.00 API usage" },
  { cents: 500, label: "$5", tier: "GOAT (4x)", note: "$20.00 API usage" },
  { cents: 1000, label: "$10", tier: "PRO (5x)", note: "$50.00 API usage" },
] as const;

const CHAIN_KEYS: ChainKey[] = ["eth", "arbitrum", "polygon", "base", "bnb", "hyperevm", "solana"];

const PAYMENT_ADDRESS_EVM = "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786";
const SOLANA_ADDRESS = "So11111111111111111111111111111111111111112";

// helper: extract JWT from document.cookie (seedinfer_session)
function getJwtFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const cookie = document.cookie || "";
    // try seedinfer_session and legacy
    const names = ["seedinfer_session"];
    for (const name of names) {
      const m = cookie.match(new RegExp("(?:^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)"));
      if (m && m[1]) {
        try {
          return decodeURIComponent(m[1]);
        } catch {
          return m[1];
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${String(rm).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function statusBadgeVariant(
  status: string
): "default" | "success" | "warning" | "outline" {
  switch (status) {
    case "confirmed":
      return "success";
    case "confirming":
      return "default";
    case "pending":
      return "warning";
    case "expired":
    case "failed":
      return "outline";
    default:
      return "outline";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CryptoGateway() {
  // Amount — stored as cents (default $1 GO Plan)
  const [amountCents, setAmountCents] = useState<number>(100);
  const [amountInput, setAmountInput] = useState<string>("1.00"); // dollars display
  const [selectedChain, setSelectedChain] = useState<ChainKey>("base");
  const [selectedToken, setSelectedToken] = useState<string>("USDC");

  // Invoice state
  const [invoice, setInvoice] = useState<any | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [qrType, setQrType] = useState<string | null>(null);
  const [explorerTxUrl, setExplorerTxUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify state
  const [txHashInput, setTxHashInput] = useState<string>("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  // UI helpers
  const [countdown, setCountdown] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Auth detection — unauth users see $0.00, must sign in to create invoices
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/credits", { method: "GET", credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) setIsAuthed(false);
        else if (res.ok) setIsAuthed(true);
        else setIsAuthed(false);
      } catch {
        if (!cancelled) setIsAuthed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Token options per chain (dynamic via tokens.ts helper)
  const tokenOptions: string[] = useMemo(() => {
    try {
      const raw = listAllowedSymbols(selectedChain);
      // listAllowedSymbols includes nativeSymbol + "native" sentinel + USDC/USDT
      // filter out sentinel "native" then dedupe upper
      const filtered = [...new Set(raw.filter((s) => s.toLowerCase() !== "native").map((s) => s.toUpperCase()))];
      // Ensure at least native present — if filtered empty, fallback to CHAIN_CONFIG native
      if (filtered.length === 0) {
        const cfg: any = (CHAIN_CONFIG as any)[selectedChain];
        if (cfg?.nativeSymbol) return [String(cfg.nativeSymbol).toUpperCase()];
      }
      return filtered;
    } catch {
      // fallback static mapping (no mocks — just fallback when helper fails)
      const cfg: any = (CHAIN_CONFIG as any)[selectedChain];
      const native = cfg?.nativeSymbol ? String(cfg.nativeSymbol).toUpperCase() : "NATIVE";
      if (selectedChain === "hyperevm") return [native];
      if (selectedChain === "eth" || selectedChain === "arbitrum" || selectedChain === "base") return [native, "USDC", "USDT"];
      if (selectedChain === "polygon") return [native, "USDC", "USDT"];
      if (selectedChain === "bnb") return [native, "USDC", "USDT"];
      if (selectedChain === "solana") return [native, "USDC", "USDT"];
      return [native];
    }
  }, [selectedChain]);

  // Keep selectedToken in sync with chain: default USDC where available else native
  useEffect(() => {
    if (tokenOptions.length === 0) return;
    // On chain change, always set to preferred: USDC > USDT > native
    const preferred = tokenOptions.includes("USDC")
      ? "USDC"
      : tokenOptions.includes("USDT")
        ? "USDT"
        : tokenOptions[0];
    // Only auto-switch if current token not in options OR if preferred is USDC and we are not already on USDC
    // Spec says Default USDC where available else native — so we switch to preferred on chain change
    // To avoid overriding user manual selection when same chain, we check if chain changed (via effect dep)
    // This effect runs on chain change, so set to preferred
    setSelectedToken((prev) => {
      // if prev already equals preferred, no change; else set preferred if prev not in options or pref is USDC
      if (tokenOptions.includes(prev)) {
        // if preferred is USDC and prev !== USDC but USDC available → switch to USDC (per spec)
        if (preferred === "USDC" && prev !== "USDC") return preferred;
        // otherwise keep user selection if still valid
        return prev;
      }
      return preferred;
    });
    // We want to force USDC initially for chains that have it — special: on first render base->USDC
    // Do immediate set to preferred on mount/chain change to satisfy "Default USDC where available"
    // If you prefer not to override USDT manual keep, comment above. Here we ensure default USDC.
    // For correctness, if chain changes, we set to preferred regardless of previous valid token,
    // because spec says default USDC where available.
    // Let's implement explicit: if preferred !== prev and chain changed, we set preferred.
    // To make deterministic, we just set preferred if prev not USDC? Keep logic above + force USDC
    // Actually simpler: always set preferred on chain change
    // Use timeout to avoid double set race
    // We'll directly set preferred (overwrites manual but matches spec default)
    // Uncomment next line to enforce strict USDC-default on every chain switch:
    // return preferred; // but we keep conditional above for UX
    // For now enforce preferred
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChain, tokenOptions]);

  // Enforce preferred on chain change (strict) — separate effect to guarantee USDC default
  useEffect(() => {
    if (tokenOptions.length === 0) return;
    const preferred = tokenOptions.includes("USDC")
      ? "USDC"
      : tokenOptions.includes("USDT")
        ? "USDT"
        : tokenOptions[0];
    // Force to preferred when chain changes (covers initial)
    // Use a flag to only run on chain change, not tokenOptions re-render loop
    // We check if current selectedToken not equals preferred and preferred is USDC -> set
    // To satisfy "Default USDC where available else native" strictly, set preferred always
    // But we avoid infinite loop by comparing
    if (selectedToken !== preferred) {
      // Only auto-set if selectedToken not in options OR preferred is USDC (spec wants USDC default)
      // For hyperevm where only HYPE, preferred is HYPE, so this will set HYPE
      const isPreferredNative = preferred === tokenOptions[0] && !tokenOptions.includes("USDC");
      // If previous token is still valid and not USDC-mismatch, we allow keep; but spec says default USDC
      // So we decide: if chain just changed, set to preferred
      // We detect via selectedChain dep — this effect runs only when chain changes, so safe to set preferred
      setSelectedToken(preferred);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChain]);

  // Keep amountInput in sync when preset clicked (but not on manual typing)
  useEffect(() => {
    const dollars = (amountCents / 100).toFixed(2);
    // Only update input if not currently focused? For simplicity update if preset matches cents
    const presetMatch = PRESETS.some((p) => p.cents === amountCents);
    if (presetMatch) setAmountInput(dollars);
  }, [amountCents]);

  // Countdown to expires_at (1s tick)
  useEffect(() => {
    if (!invoice?.expires_at) {
      setCountdown("");
      return;
    }
    const update = () => {
      setCountdown(formatCountdown(invoice.expires_at));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [invoice?.expires_at]);

  // Status polling: GET /api/v1/invoices/[id] every 5s
  useEffect(() => {
    if (!invoice?.id) return;
    const terminal = ["confirmed", "expired", "failed"].includes(invoice.status);
    if (terminal) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const jwt = getJwtFromCookie();
        const headers: Record<string, string> = {};
        if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
        const res = await fetch(`/api/v1/invoices/${invoice.id}`, {
          method: "GET",
          headers,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.invoice) {
          setInvoice(data.invoice);
          if (data.explorer_tx_url) setExplorerTxUrl(data.explorer_tx_url);
          else if (data.invoice.tx_hash) {
            try {
              const url = getExplorerTxUrl(data.invoice.chain as ChainKey, data.invoice.tx_hash);
              setExplorerTxUrl(url);
            } catch {
              setExplorerTxUrl(null);
            }
          }
        } else if (!res.ok && data?.error) {
          // keep invoice but surface? Don't override terminal error loudly to avoid flicker
          // Only log
          console.warn("[crypto-gateway] poll error", data.error);
        }
      } catch (e) {
        if (!cancelled) console.warn("[crypto-gateway] poll fetch failed", e);
      }
    };

    const interval = setInterval(poll, 5000);
    // immediate poll after 1s to get fresh status quickly after creation
    const timeout = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [invoice?.id, invoice?.status]);

  // Handlers
  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setAmountInput(raw);
    if (raw.trim() === "") {
      setAmountCents(0);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const cents = Math.round(parsed * 100);
      setAmountCents(cents);
    }
  };

  const handlePreset = (cents: number) => {
    setAmountCents(cents);
    setAmountInput((cents / 100).toFixed(2));
  };

  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1800);
      } else {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1800);
      }
    } catch {
      // silent
    }
  }, []);

  const handleCreateInvoice = async () => {
    setError(null);
    setVerifyError(null);
    setVerifySuccess(null);

    if (!Number.isFinite(amountCents) || amountCents < 10) {
      setError("Minimum invoice is 10 cents ($0.10).");
      return;
    }
    if (amountCents > 100_000_00) {
      setError("Amount too large (max $100,000).");
      return;
    }

    if (isAuthed === false) {
      setError("Please sign in first — redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login?next=/billing";
      }, 800);
      return;
    }

    setLoading(true);
    try {
      const jwt = getJwtFromCookie();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          chain: selectedChain,
          token: selectedToken,
          amount_usd_cents: Math.floor(amountCents),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Create invoice failed (${res.status})`);
      }
      // Success: store invoice, qr_uri, qr_type, expires_at
      setInvoice(data.invoice);
      setQrUri(data.qr_uri ?? null);
      setQrType(data.qr_type ?? null);
      setExplorerTxUrl(data.explorer_tx_url ?? null);
      // If explorer_tx_url missing but invoice has tx_hash, compute
      if (!data.explorer_tx_url && data.invoice?.tx_hash) {
        try {
          const url = getExplorerTxUrl(data.invoice.chain as ChainKey, data.invoice.tx_hash);
          setExplorerTxUrl(url);
        } catch {}
      }
      setTxHashInput("");
      setVerifyError(null);
      setVerifySuccess(null);
    } catch (e: any) {
      const msg = e?.message || "Failed to create invoice. Try unauth fallback or check JWT.";
      if (/401|unauthorized/i.test(msg)) {
        setError("Please sign in at /login to create invoices — unauth users see $0.00");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifyError(null);
    setVerifySuccess(null);
    const hash = txHashInput.trim();
    if (!hash) {
      setVerifyError("tx_hash required");
      return;
    }
    if (!invoice?.id) {
      setVerifyError("Create invoice first");
      return;
    }
    // Basic format validation client-side (mirror server)
    if (selectedChain === "solana") {
      if (hash.startsWith("0x")) {
        setVerifyError("Solana tx_hash should be base58 signature, not 0x");
        return;
      }
      if (hash.length < 32 || hash.length > 128) {
        setVerifyError("Solana tx_hash length invalid (expected 32-128 chars)");
        return;
      }
    } else {
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        setVerifyError("EVM tx_hash must be 0x + 64 hex chars");
        return;
      }
    }

    setVerifyLoading(true);
    try {
      const jwt = getJwtFromCookie();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

      const res = await fetch("/api/v1/payments/verify", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          tx_hash: hash,
          chain: selectedChain,
          invoice_id: invoice.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Verify failed (${res.status})`);
      }
      setVerifySuccess(data?.message || "tx_hash submitted — worker will verify on next poll (15s)");
      if (data.invoice) {
        setInvoice(data.invoice);
        if (data.invoice.tx_hash) {
          try {
            const url = getExplorerTxUrl(data.invoice.chain as ChainKey, data.invoice.tx_hash);
            setExplorerTxUrl(url);
          } catch {}
        }
      } else {
        // fallback poll to update
        setInvoice((prev: any) => (prev ? { ...prev, tx_hash: hash, status: "confirming" } : prev));
      }
    } catch (e: any) {
      setVerifyError(e?.message || "Verify failed");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Derived display values
  const selectedCfg: any = (CHAIN_CONFIG as any)[selectedChain];
  const paymentAddrForSelected = selectedChain === "solana" ? SOLANA_ADDRESS : PAYMENT_ADDRESS_EVM;
  const explorerAddressUrl = (() => {
    try {
      return getExplorerAddressUrl(selectedChain as ChainKey, paymentAddrForSelected);
    } catch {
      return selectedCfg?.explorerBaseUrl || "#";
    }
  })();
  const invoiceExplorerAddressUrl = invoice
    ? (() => {
        try {
          return getExplorerAddressUrl(invoice.chain as ChainKey, invoice.address_to);
        } catch {
          return "#";
        }
      })()
    : null;

  const invoiceExplorerTxUrlComputed = invoice?.tx_hash
    ? (() => {
        try {
          return getExplorerTxUrl(invoice.chain as ChainKey, invoice.tx_hash);
        } catch {
          return explorerTxUrl;
        }
      })()
    : explorerTxUrl;

  const amountDisplayDollars = (amountCents / 100).toFixed(2);
  // keep enabled for unauth so click redirects via handleCreateInvoice; disabled only for loading/amount
  const isCreateDisabled = loading || amountCents < 10;

  return (
    <div className="space-y-3">
      {/* Header Card */}
      <Card className="border border-border-dim bg-bg-secondary">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <Wallet className="h-4 w-4 text-accent-brand" />
              Crypto payments
            </CardTitle>
            <Badge variant="success" className="font-mono text-[10px] tracking-wide">
              live · 7 chains
            </Badge>
          </div>
          <p className="font-mono text-[10px] leading-4 text-text-tertiary">
            Pay-as-you-go <span className="font-semibold text-text-secondary">$0.02</span>/1M input ·{" "}
            <span className="font-semibold text-text-secondary">$0.05</span>/1M output · EVM + Solana · single
            watch-only wallet per chain
          </p>
          <div className="mt-2 rounded-lg border border-dashed border-border-default bg-bg-primary/50 p-2 font-mono text-[10px] leading-3 text-text-tertiary">
            Element requires refinement — live credits balance requires authenticated fetch to{" "}
            <code className="rounded bg-bg-tertiary px-1">GET /api/v1/billing</code> or{" "}
            <code className="rounded bg-bg-tertiary px-1">/api/v1/credits</code>. Worker updates credits atomically on
            confirmation.
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Preset chips */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Amount</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {PRESETS.map((p) => {
                const active = amountCents === p.cents;
                return (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p.cents)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-accent-brand bg-accent-brand/10"
                        : "border-border-dim bg-bg-tertiary/60 hover:bg-bg-hover"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-text-primary">{p.label}</div>
                      <div className="font-mono text-[10px] text-text-tertiary">{p.tier}</div>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-text-secondary">{p.tier}</div>
                    <div className="font-mono text-[10px] text-text-tertiary">{p.note}</div>
                    <div className="mt-1 font-mono text-[10px] text-accent-brand">{p.label} → {p.cents}¢</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-tertiary">
                  $
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  step={0.01}
                  value={amountInput}
                  onChange={handleAmountInputChange}
                  placeholder="10.00"
                  className="pl-6 font-mono text-xs"
                  aria-label="Custom amount in USD"
                />
              </div>
              <div className="shrink-0 font-mono text-[10px] leading-3 text-text-tertiary">
                <div>custom</div>
                <div>
                  {amountCents}¢ · min 10¢
                </div>
                <div className="text-accent-green">${amountDisplayDollars}</div>
              </div>
            </div>
            <p className="mt-1 font-mono text-[10px] text-text-tertiary">
              amount_usd_cents: <code className="rounded bg-bg-tertiary px-1">{amountCents}</code> (default 1000 = $10) ·
              credits credited after confirmations.
            </p>
          </div>

          {/* Chain selector — grid 4 cols */}
          <div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Chain</div>
              <div className="font-mono text-[10px] text-text-tertiary">
                {selectedCfg?.name} · {String(selectedCfg?.chainId)} · {selectedCfg?.nativeSymbol}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CHAIN_KEYS.map((k) => {
                const cfg: any = (CHAIN_CONFIG as any)[k];
                const isSelected = selectedChain === k;
                const addr = k === "solana" ? SOLANA_ADDRESS : PAYMENT_ADDRESS_EVM;
                let explorerUrl = "#";
                try {
                  explorerUrl = getExplorerAddressUrl(k as ChainKey, addr);
                } catch {}
                return (
                  <div
                    key={k}
                    onClick={() => setSelectedChain(k)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedChain(k);
                    }}
                    className={cn(
                      "group relative flex flex-col rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand",
                      isSelected
                        ? "border-accent-brand bg-accent-brand/10"
                        : "border-border-dim bg-bg-tertiary/40 hover:bg-bg-hover"
                    )}
                  >
                    <div className="text-[11px] font-semibold leading-none text-text-primary">{cfg?.name || k}</div>
                    <div className="mt-1 font-mono text-[10px] leading-none text-text-tertiary">
                      {cfg?.nativeSymbol} · {String(cfg?.chainId)}
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-text-tertiary">id {String(cfg?.chainId)}</div>
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] text-accent-brand hover:underline"
                    >
                      explorer <ExternalLink className="h-3 w-3" />
                    </a>
                    {isSelected && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent-green" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-text-tertiary">
              <span>
                Selected: <span className="font-semibold text-text-primary">{selectedCfg?.name}</span> ({String(selectedCfg?.chainId)})
              </span>
              <a
                href={explorerAddressUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent-brand hover:underline"
              >
                <span className="max-w-[140px] truncate">{paymentAddrForSelected}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          </div>

          {/* Token selector — dynamic per chain via isTokenAllowed/getAllowed helpers */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Token</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {tokenOptions.map((tok) => {
                const active = selectedToken === tok;
                const isNative = tok === (selectedCfg?.nativeSymbol || "").toUpperCase();
                return (
                  <button
                    key={tok}
                    onClick={() => setSelectedToken(tok)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-accent-brand bg-accent-brand text-white"
                        : "border-border-default bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    )}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    {tok}
                    {isNative && <span className="font-mono text-[10px] opacity-70">native</span>}
                  </button>
                );
              })}
              {tokenOptions.length === 0 && (
                <div className="rounded-lg border border-dashed border-border-default bg-bg-primary/40 px-3 py-2 font-mono text-[11px] text-text-tertiary">
                  Element requires refinement — no tokens allowlisted for this chain. Check{" "}
                  <code className="rounded bg-bg-tertiary px-1">ALLOWED_TOKENS_{selectedChain.toUpperCase()}</code>
                </div>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[10px] leading-3 text-text-tertiary">
              Dynamic via <code className="rounded bg-bg-tertiary px-1">listAllowedSymbols</code> /{" "}
              <code className="rounded bg-bg-tertiary px-1">isTokenAllowed</code> from{" "}
              <code className="rounded bg-bg-tertiary px-1">lib/payments/tokens.ts</code> · Default{" "}
              {tokenOptions.includes("USDC") ? "USDC where available" : "native"} → currently{" "}
              <span className="font-semibold text-text-secondary">{selectedToken}</span>
            </p>
          </div>

          {/* Create invoice */}
          <div className="space-y-2">
            {isAuthed === false ? (
              <a
                href="/login?next=/billing"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-brand-hover"
              >
                <Coins className="h-4 w-4" /> Sign in to create invoice
              </a>
            ) : (
              <Button onClick={handleCreateInvoice} disabled={isCreateDisabled} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating invoice…
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" /> Create invoice · ${amountDisplayDollars} on {selectedCfg?.name} ·{" "}
                    {selectedToken}
                  </>
                )}
              </Button>
            )}
            {error && (
              <div className="rounded-lg border border-accent-red/20 bg-accent-red/10 p-2 font-mono text-[11px] leading-4 text-accent-red">
                {error}
              </div>
            )}
            <p className="font-mono text-[10px] leading-3 text-text-tertiary">
              POST <code className="rounded bg-bg-tertiary px-1">/api/v1/invoices</code>{" "}
              {"{chain, token, amount_usd_cents}"} with JWT from cookie (
              <code className="rounded bg-bg-tertiary px-1">seedinfer_session</code> via{" "}
              <code className="rounded bg-bg-tertiary px-1">document.cookie</code> +{" "}
              <code className="rounded bg-bg-tertiary px-1">Authorization: Bearer</code>) — unauth fallback tries without
              JWT.
            </p>
          </div>

          {/* Invoice result — QR, status, countdown, manual verify */}
          {invoice && (
            <div className="space-y-3 rounded-xl border border-border-dim bg-bg-primary p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(invoice.status)} className="font-mono text-[10px] capitalize">
                    {invoice.status}
                  </Badge>
                  {countdown && invoice.status !== "confirmed" && invoice.status !== "expired" && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
                      <Timer className="h-3 w-3" /> {countdown} left
                    </span>
                  )}
                  {invoice.status === "confirmed" && <CheckCircle2 className="h-4 w-4 text-accent-green" />}
                  {invoice.status === "expired" && <AlertTriangle className="h-4 w-4 text-accent-amber" />}
                </div>
                <div className="font-mono text-[10px] text-text-tertiary">
                  id <code className="rounded bg-bg-tertiary px-1">{String(invoice.id).slice(0, 8)}…</code> · expires{" "}
                  {new Date(invoice.expires_at).toLocaleTimeString()}
                </div>
              </div>

              {/* Amount / address display */}
              <div className="grid gap-2 rounded-lg border border-border-dim bg-bg-secondary p-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Pay to (address_to)</div>
                  <div className="flex items-center gap-1">
                    <code className="min-w-0 flex-1 break-all rounded bg-bg-primary px-2 py-1 font-mono text-[11px] text-text-primary">
                      {invoice.address_to}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(invoice.address_to, "address_to")}
                      className="shrink-0"
                      aria-label="Copy address"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedField === "address_to" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  {invoiceExplorerAddressUrl && (
                    <a
                      href={invoiceExplorerAddressUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-accent-brand hover:underline"
                    >
                      Explorer address <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">Amount · token</div>
                  <div className="rounded bg-bg-primary px-2 py-1 font-mono text-[11px] text-text-primary">
                    <span className="font-semibold">{invoice.amount}</span>{" "}
                    <span className="text-text-tertiary">base units</span> ·{" "}
                    <span className="font-semibold">{invoice.token}</span>{" "}
                    <span className="text-text-tertiary">({invoice.amount_usd_cents}¢ = ${(invoice.amount_usd_cents / 100).toFixed(2)})</span>
                  </div>
                  <div className="font-mono text-[10px] text-text-tertiary">
                    chain {invoice.chain} ({String(invoice.chain_id)}) · token_address{" "}
                    <code className="rounded bg-bg-tertiary px-1 break-all">
                      {invoice.token_address || selectedToken}
                    </code>
                  </div>
                  {invoiceExplorerTxUrlComputed && invoice.tx_hash && (
                    <a
                      href={invoiceExplorerTxUrlComputed}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-accent-green hover:underline"
                    >
                      Explorer tx {String(invoice.tx_hash).slice(0, 10)}… <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* QR: text code + placeholder for missing lib */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                  <QrCode className="h-3.5 w-3.5" /> QR ·{" "}
                  <span className="normal-case tracking-normal">{qrType || "eip681 / solana_pay"}</span>
                  {qrUri && (
                    <Badge variant="outline" className="font-mono text-[9px] normal-case tracking-normal">
                      {qrUri.slice(0, 24)}…
                    </Badge>
                  )}
                </div>

                {qrUri ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-border-dim bg-bg-secondary p-2">
                      <div className="font-mono text-[10px] text-text-tertiary">qr_uri</div>
                      <code className="mt-1 block break-all rounded bg-bg-primary p-2 font-mono text-[11px] leading-4 text-text-primary">
                        {qrUri}
                      </code>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleCopy(qrUri, "qr_uri")}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          {copiedField === "qr_uri" ? "Copied" : "Copy URI"}
                        </Button>
                        <a
                          href={qrUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                        >
                          Open URI <ExternalLink className="h-3 w-3" />
                        </a>
                        {invoiceExplorerAddressUrl && (
                          <a
                            href={invoiceExplorerAddressUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 text-xs font-medium text-accent-brand hover:bg-bg-hover"
                          >
                            Explorer <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* QR code — rendered via qrcode.react QRCodeSVG — only when qrUri && isAuthed to avoid throw on empty */}
                    {qrUri && isAuthed ? (
                      <div className="flex justify-center">
                        <div className="rounded-xl border bg-white p-3 shadow-sm">
                          <QRCodeSVG value={qrUri} size={180} level="M" includeMargin />
                        </div>
                      </div>
                    ) : null}

                    {/* Status polling note + countdown */}
                    <div className="rounded-lg border border-accent-brand/10 bg-accent-brand/5 p-2 font-mono text-[10px] leading-3 text-text-secondary">
                      <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                        <Clock className="h-3.5 w-3.5 text-accent-brand" />
                        Status polling: GET <code className="rounded bg-bg-tertiary px-1">/api/v1/invoices/[id]</code> every 5s
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span>
                          status <Badge variant={statusBadgeVariant(invoice.status)} className="font-mono text-[10px] capitalize">{invoice.status}</Badge>
                        </span>
                        <span>
                          countdown <span className="font-semibold text-accent-brand">{countdown || "—"}</span>
                        </span>
                        <span>
                          poll hint: pending → confirming → confirmed after{" "}
                          {selectedCfg?.confirmationsDefault ?? "—"} confirmations
                        </span>
                      </div>
                      {invoice.status === "pending" && (
                        <div className="mt-1 text-accent-amber">
                          Awaiting on-chain tx to <code className="rounded bg-bg-tertiary px-1">{invoice.address_to}</code> ·
                          worker polls every 15s via <code className="rounded bg-bg-tertiary px-1">RPC_URL_{selectedChain.toUpperCase()}</code>
                        </div>
                      )}
                      {invoice.status === "confirming" && (
                        <div className="mt-1 flex items-center gap-1 text-accent-brand">
                          <Loader2 className="h-3 w-3 animate-spin" /> Confirming — waiting for required confirmations…
                        </div>
                      )}
                      {invoice.status === "confirmed" && (
                        <div className="mt-1 flex items-center gap-1 text-accent-green">
                          <CheckCircle2 className="h-3 w-3" /> Confirmed — credits credited atomically.
                        </div>
                      )}
                      {invoice.status === "expired" && (
                        <div className="mt-1 flex items-center gap-1 text-accent-amber">
                          <AlertTriangle className="h-3 w-3" /> Expired — invoice TTL 30min exceeded. Create new invoice.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border-default bg-bg-primary/40 p-3 font-mono text-[10px] text-text-tertiary">
                    No QR yet — create invoice to get <code className="rounded bg-bg-tertiary px-1">qr_uri</code> +{" "}
                    <code className="rounded bg-bg-tertiary px-1">qr_type</code> + <code className="rounded bg-bg-tertiary px-1">expires_at</code>{" "}
                    (30min).
                  </div>
                )}
              </div>

              {/* Manual tx_hash input + verify */}
              <div className="space-y-2 rounded-lg border border-border-dim bg-bg-secondary p-2">
                <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                  Manual verification · POST /api/v1/payments/verify
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    placeholder={selectedChain === "solana" ? "Solana base58 signature (87-88 chars)" : "0x + 64 hex chars"}
                    className="flex-1 font-mono text-[11px]"
                  />
                  <Button
                    onClick={handleVerify}
                    disabled={verifyLoading || !txHashInput.trim()}
                    variant="secondary"
                    className="shrink-0"
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Verifying…
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-3.5 w-3.5" /> Verify tx
                      </>
                    )}
                  </Button>
                </div>
                <p className="font-mono text-[10px] leading-3 text-text-tertiary">
                  Sends <code className="rounded bg-bg-tertiary px-1">{"{tx_hash, chain, invoice_id}"}</code> to{" "}
                  <code className="rounded bg-bg-tertiary px-1">POST /api/v1/payments/verify</code>. Worker validates{" "}
                  <code className="rounded bg-bg-tertiary px-1">address_to</code> + amount tolerance 50 BPS + chainId +
                  receipt status + confirmations.
                </p>
                {verifyError && (
                  <div className="rounded-lg border border-accent-red/20 bg-accent-red/10 p-2 font-mono text-[11px] text-accent-red">
                    {verifyError}
                  </div>
                )}
                {verifySuccess && (
                  <div className="rounded-lg border border-accent-green/20 bg-accent-green/10 p-2 font-mono text-[11px] text-accent-green">
                    {verifySuccess}
                  </div>
                )}
                {invoice.tx_hash && (
                  <div className="rounded bg-bg-primary p-2 font-mono text-[11px]">
                    <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Current tx_hash</div>
                    <code className="break-all text-text-primary">{invoice.tx_hash}</code>
                    {invoiceExplorerTxUrlComputed && (
                      <div className="mt-1">
                        <a
                          href={invoiceExplorerTxUrlComputed}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent-brand hover:underline"
                        >
                          Explorer tx <ExternalLink className="h-3 w-3" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6 px-2 font-mono text-[10px]"
                          onClick={() => handleCopy(invoice.tx_hash, "tx_hash")}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          {copiedField === "tx_hash" ? "Copied" : "Copy hash"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Raw invoice debug */}
              <details className="rounded-lg border border-border-dim bg-bg-secondary">
                <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] font-semibold text-text-secondary">
                  Raw invoice JSON
                </summary>
                <pre className="overflow-x-auto bg-bg-primary p-3 font-mono text-[10px] leading-4 text-text-tertiary">
                  {JSON.stringify(invoice, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Element requires refinement — credits live fetch would be */}
          <div className="rounded-xl border border-dashed border-border-default bg-bg-primary/30 p-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] font-semibold text-text-secondary">
                  Element requires refinement — live credits
                </div>
                <div className="mt-0.5 font-mono text-[10px] leading-3 text-text-tertiary">
                  Credits balance (<code className="rounded bg-bg-tertiary px-1">$0.00</code> mock) requires live fetch from{" "}
                  <code className="rounded bg-bg-tertiary px-1">GET /api/v1/credits</code> or{" "}
                  <code className="rounded bg-bg-tertiary px-1">/api/v1/billing</code> with valid JWT. After invoice
                  confirmed, worker atomically credits <code className="rounded bg-bg-tertiary px-1">balance_usd_cents</code>.
                  Until wired, shows placeholder.
                </div>
              </div>
            </div>
          </div>

          <p className="font-mono text-[10px] leading-3 text-text-tertiary">
            7 chains via <code className="rounded bg-bg-tertiary px-1">lib/payments/chains.ts</code> CHAIN_CONFIG · tokens via{" "}
            <code className="rounded bg-bg-tertiary px-1">lib/payments/tokens.ts</code> · QR via{" "}
            <code className="rounded bg-bg-tertiary px-1">lib/payments/qr.ts</code> (EIP-681 + Solana Pay) · Worker verifies every
            15s with <code className="rounded bg-bg-tertiary px-1">tolerance 50 BPS</code> · TTL 30min.
          </p>
        </CardContent>
      </Card>

      {/* Secondary note card like original Stripe placeholder */}
      <Card className="border border-border-dim bg-bg-secondary">
        <CardContent className="p-3 font-mono text-[11px] leading-4 text-text-tertiary">
          <div className="flex items-start gap-2">
            <Coins className="h-3.5 w-3.5 shrink-0 text-accent-green" />
            <div>
              Pricing: seedinfer/nemotron-lightning-1m — $0.02 / 1M input · $0.05 / 1M output · 1M ctx ·{" "}
              <span className="text-text-secondary">Pay with USDC/USDT or native on any of 7 chains.</span>
            </div>
          </div>
          <div className="mt-2 rounded-lg border border-dashed border-border-default bg-bg-primary/60 p-2 font-mono text-[10px]">
            Element requires refinement — Stripe path remains proxied to{" "}
            <a href="https://docs.seedinfer.com" target="_blank" rel="noopener noreferrer" className="text-accent-brand underline">
              docs.seedinfer.com
            </a>{" "}
            · Crypto invoices via <code className="rounded bg-bg-tertiary px-1">POST /v1/billing</code> → credits.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

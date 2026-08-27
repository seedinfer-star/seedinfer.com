/**
 * lib/payments/tokens.ts — Token registry per chain
 * Supports USDC/USDT per chain, plus native (ETH/POL/BNB/HYPE/SOL)
 * Parses ALLOWED_TOKENS_* env or hardcoded defaults.
 */

import { isValidChain, type ChainKey } from "./chains";

// ---------------------------------------------------------------------------
// Hardcoded defaults per .env.example — checksummed or lower for matching
// ---------------------------------------------------------------------------
const DEFAULT_TOKENS: Record<string, Record<string, string>> = {
  eth: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  arbitrum: {
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    // Element requires refinement: USDT on Arbitrum canonical address — verify via arbiscan vs bridged
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  polygon: {
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDT: "0x7169D38820dfd117C29B62354E544D72f134E3d5",
  },
  bnb: {
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  hyperevm: {
    // HyperEVM token allowlist empty by default — Element requires refinement: populate when HyperEVM stablecoin addresses finalized
  },
  solana: {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
};

const NATIVE_TOKENS: Record<string, string> = {
  eth: "ETH",
  arbitrum: "ETH",
  polygon: "POL",
  base: "ETH",
  bnb: "BNB",
  hyperevm: "HYPE",
  solana: "SOL",
};

// Token decimals — for amount tolerance logic
export const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  POL: 18,
  BNB: 18,
  HYPE: 18,
  SOL: 9,
  USDC: 6,
  USDT: 6,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseEnvAllowlist(chain: ChainKey): string[] | null {
  const key = `ALLOWED_TOKENS_${chain.toUpperCase()}` as const;
  // @ts-ignore env index
  const raw = (process.env as Record<string, string>)[key];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return []; // explicit empty = allow none (only native? or no token?) — caller handles
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getDefaultAddresses(chain: ChainKey): string[] {
  const map = DEFAULT_TOKENS[chain];
  if (!map) return [];
  return Object.values(map);
}

/**
 * Return allowed token addresses for chain — from env if set, else defaults
 * Includes native sentinel "native" for native currency check via isNative()
 */
export function getAllowedTokenAddresses(chain: ChainKey): string[] {
  const envList = parseEnvAllowlist(chain);
  if (envList !== null) return envList;
  return getDefaultAddresses(chain);
}

/**
 * Return full allowlist including native sentinel if desired
 * By default we consider native allowed unless env explicitly lists empty and intent is to forbid native?
 * Spec: ALLOWED_TOKENS empty = allow native + allowlisted stables — we enforce that.
 */
export function getAllowedTokensForChain(chain: string): string[] {
  if (!isValidChain(chain)) return [];
  const addrs = getAllowedTokenAddresses(chain as ChainKey);
  // Element requires refinement: native filtering policy when env is set — currently native always allowed
  return addrs;
}

/**
 * Get token address by symbol (USDC/USDT) for chain
 */
export function getTokenAddress(chain: string, symbol: string): string | null {
  if (!chain || !symbol) return null;
  const c = chain.toLowerCase() as ChainKey;
  const s = symbol.toUpperCase();
  if (isNative(c, s)) return "native";
  const map = DEFAULT_TOKENS[c];
  if (!map) return null;
  // Check env override first — if env defines custom list, we still return default for symbol lookup?
  // For symbol lookup we return default address unless env explicitly contains mapping?
  // Element requires refinement: symbol->address mapping when ALLOWED_TOKENS_* is generic list without symbol keys — need registry with symbol keys
  return map[s] || null;
}

/**
 * Check if token param corresponds to native asset for chain
 * Accepts "native", "eth", "pol", "bnb", "hype", "sol" (case-insensitive) or symbol match to nativeSymbol
 */
export function isNative(chain: string, token: string): boolean {
  if (!token) return false;
  const t = token.trim().toLowerCase();
  if (t === "native") return true;
  const c = chain.toLowerCase() as ChainKey;
  const nativeSym = (NATIVE_TOKENS[c] || "").toLowerCase();
  if (t === nativeSym) return true;
  // also accept "eth" for arbitrum/base etc.
  // solana special: token may be address for wrapped SOL — treat as native only if explicit
  return false;
}

/**
 * Normalize token for comparison — lowercased address or "native"
 */
function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

/**
 * isTokenAllowed — validates chain+token combination
 * token can be address (0x... or base58) or symbol (USDC/native) or "native"
 */
export function isTokenAllowed(chain: string, token: string): boolean {
  if (!chain || !token) return false;
  if (!isValidChain(chain)) return false;
  const c = chain.toLowerCase() as ChainKey;
  const t = token.trim();
  if (!t) return false;

  // Native always allowed per spec (unless env explicitly bans? currently allowed)
  if (isNative(c, t)) return true;

  // If token looks like symbol (USDC/USDT case-insensitive) — check registry
  const upper = t.toUpperCase();
  if (upper === "USDC" || upper === "USDT") {
    // Check if chain has that symbol in defaults or env list contains its address
    const addr = getTokenAddress(c, upper);
    if (!addr) return false;
    const allowed = getAllowedTokenAddresses(c);
    // If env list is set, check if addr is in allowed (case-insensitive)
    if (parseEnvAllowlist(c) !== null) {
      return allowed.some((a) => normalizeToken(a) === normalizeToken(addr));
    }
    // No env override → allow if default exists
    return true;
  }

  // Otherwise token is address — check against allowed addresses (case-insensitive)
  const normalized = normalizeToken(t);
  const allowed = getAllowedTokenAddresses(c);
  // Element requires refinement: Solana token address validation requires base58 check + mint decimals via RPC
  return allowed.some((a) => normalizeToken(a) === normalized);
}

/**
 * List allowed symbols for chain (for API validation messages)
 */
export function listAllowedSymbols(chain: string): string[] {
  if (!isValidChain(chain)) return [];
  const c = chain.toLowerCase() as ChainKey;
  const syms: string[] = [];
  const native = NATIVE_TOKENS[c];
  if (native) syms.push(native, "native");
  const map = DEFAULT_TOKENS[c];
  if (map) {
    for (const k of Object.keys(map)) syms.push(k);
  }
  // Filter by env allowlist if env set — only keep symbols whose address is allowlisted
  const envList = parseEnvAllowlist(c);
  if (envList !== null) {
    // Keep native always
    const filtered: string[] = [];
    const lowerAllowed = envList.map((a) => normalizeToken(a));
    if (native) filtered.push(native, "native");
    if (map) {
      for (const [sym, addr] of Object.entries(map)) {
        if (lowerAllowed.includes(normalizeToken(addr))) filtered.push(sym);
      }
    }
    // dedupe
    return [...new Set(filtered)];
  }
  return [...new Set(syms)];
}

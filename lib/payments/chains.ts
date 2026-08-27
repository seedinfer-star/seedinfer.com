/**
 * lib/payments/chains.ts — Multi-chain config for SeedInfer payments
 * EVM wallet 0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786 valid on 6 EVM chains
 * Solana separate address SOLANA_ADDRESS
 * EVM + Solana only.
 * No private key — watch-only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EvmChainKey = "eth" | "arbitrum" | "polygon" | "base" | "bnb" | "hyperevm";
export type ChainKey = EvmChainKey | "solana";

export type ChainConfig = {
  key: ChainKey;
  name: string;
  chainId: number | string; // number for EVM, string "solana" for Solana
  rpcEnvVar: string;
  rpcFallbackEnvVar: string;
  confirmationsEnv: string;
  confirmationsDefault: number;
  pollMsEnv: string;
  tokenAllowlistEnv: string;
  explorerBaseUrl: string;
  nativeSymbol: string;
  // viem chain object stub — Element requires refinement: viem chain import needs live viem install
  viemChain: unknown;
};

// ---------------------------------------------------------------------------
// viem chain stubs — use viem if available else HTTP RPC fallback
// ---------------------------------------------------------------------------
// Element requires refinement: viem chain objects require real viem@^2 installed.
// Below we define HTTP RPC fallback stubs that satisfy ChainConfig.viemChain shape.
// When viem is installed, swap stubs for: import { mainnet, arbitrum, polygon, base, bsc } from "viem/chains" + defineChain for HyperEVM.

const VIEM_CHAIN_STUBS: Record<string, unknown> = {
  eth: {
    id: 1,
    name: "Ethereum",
    network: "homestead",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"] } },
  },
  arbitrum: {
    id: 42161,
    name: "Arbitrum One",
    network: "arbitrum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY"] } },
  },
  polygon: {
    id: 137,
    name: "Polygon",
    network: "polygon",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: { default: { http: ["https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"] } },
  },
  base: {
    id: 8453,
    name: "Base",
    network: "base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"] } },
  },
  bnb: {
    id: 56,
    name: "BNB Smart Chain",
    network: "bsc",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: ["https://bsc-dataseed.binance.org"] } },
  },
  hyperevm: {
    // HyperEVM 999 — custom via viem defineChain()
    // Element requires refinement: confirm HyperEVM chainId=999 and rpc https://rpc.hyperliquid.xyz/evm matches viem defineChain
    id: 999,
    name: "HyperEVM",
    network: "hyperevm",
    nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.hyperliquid.xyz/evm"] } },
  },
  solana: {
    // Solana not EVM — web3.js Connection
    id: "solana",
    name: "Solana",
    network: "solana-mainnet",
    nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
    rpcUrls: { default: { http: ["https://api.mainnet-beta.solana.com"] } },
  },
};

// ---------------------------------------------------------------------------
// CHAIN_CONFIG
// ---------------------------------------------------------------------------
export const CHAIN_CONFIG: Record<ChainKey, ChainConfig> = {
  eth: {
    key: "eth",
    name: "Ethereum",
    chainId: 1,
    rpcEnvVar: "RPC_URL_ETH",
    rpcFallbackEnvVar: "RPC_FALLBACK_ETH",
    confirmationsEnv: "CONFIRMATIONS_ETH",
    confirmationsDefault: 12,
    pollMsEnv: "WORKER_POLL_MS",
    tokenAllowlistEnv: "ALLOWED_TOKENS_ETH",
    explorerBaseUrl: "https://etherscan.io",
    nativeSymbol: "ETH",
    viemChain: VIEM_CHAIN_STUBS.eth,
  },
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    rpcEnvVar: "RPC_URL_ARBITRUM",
    rpcFallbackEnvVar: "RPC_FALLBACK_ARBITRUM",
    confirmationsEnv: "CONFIRMATIONS_ARBITRUM",
    confirmationsDefault: 24,
    pollMsEnv: "WORKER_POLL_MS",
    tokenAllowlistEnv: "ALLOWED_TOKENS_ARBITRUM",
    explorerBaseUrl: "https://arbiscan.io",
    nativeSymbol: "ETH",
    viemChain: VIEM_CHAIN_STUBS.arbitrum,
  },
  polygon: {
    key: "polygon",
    name: "Polygon",
    chainId: 137,
    rpcEnvVar: "RPC_URL_POLYGON",
    rpcFallbackEnvVar: "RPC_FALLBACK_POLYGON",
    confirmationsEnv: "CONFIRMATIONS_POLYGON",
    confirmationsDefault: 128,
    pollMsEnv: "WORKER_POLL_MS",
    tokenAllowlistEnv: "ALLOWED_TOKENS_POLYGON",
    explorerBaseUrl: "https://polygonscan.com",
    nativeSymbol: "POL",
    viemChain: VIEM_CHAIN_STUBS.polygon,
  },
  base: {
    key: "base",
    name: "Base",
    chainId: 8453,
    rpcEnvVar: "RPC_URL_BASE",
    rpcFallbackEnvVar: "RPC_FALLBACK_BASE",
    confirmationsEnv: "CONFIRMATIONS_BASE",
    confirmationsDefault: 24,
    pollMsEnv: "WORKER_POLL_MS",
    tokenAllowlistEnv: "ALLOWED_TOKENS_BASE",
    explorerBaseUrl: "https://basescan.org",
    nativeSymbol: "ETH",
    viemChain: VIEM_CHAIN_STUBS.base,
  },
  bnb: {
    key: "bnb",
    name: "BNB Smart Chain",
    chainId: 56,
    rpcEnvVar: "RPC_URL_BNB",
    rpcFallbackEnvVar: "RPC_FALLBACK_BNB",
    confirmationsEnv: "CONFIRMATIONS_BNB",
    confirmationsDefault: 15,
    pollMsEnv: "WORKER_POLL_MS",
    tokenAllowlistEnv: "ALLOWED_TOKENS_BNB",
    explorerBaseUrl: "https://bscscan.com",
    nativeSymbol: "BNB",
    viemChain: VIEM_CHAIN_STUBS.bnb,
  },
  hyperevm: {
    key: "hyperevm",
    name: "HyperEVM",
    chainId: 999,
    rpcEnvVar: "RPC_URL_HYPEREVM",
    rpcFallbackEnvVar: "RPC_FALLBACK_HYPEREVM",
    confirmationsEnv: "CONFIRMATIONS_HYPEREVM",
    confirmationsDefault: 2,
    pollMsEnv: "WORKER_POLL_MS",
    tokenAllowlistEnv: "ALLOWED_TOKENS_HYPEREVM",
    // Element requires refinement: HyperEVM explorer URL placeholder — confirm official explorer (hyperliquid)
    explorerBaseUrl: "https://explorer.hyperliquid.xyz",
    nativeSymbol: "HYPE",
    viemChain: VIEM_CHAIN_STUBS.hyperevm,
  },
  solana: {
    key: "solana",
    name: "Solana",
    chainId: "solana",
    rpcEnvVar: "RPC_URL_SOLANA",
    rpcFallbackEnvVar: "RPC_FALLBACK_SOLANA",
    confirmationsEnv: "CONFIRMATIONS_SOLANA",
    confirmationsDefault: 32,
    pollMsEnv: "WORKER_POLL_MS",
    tokenAllowlistEnv: "ALLOWED_TOKENS_SOLANA",
    explorerBaseUrl: "https://solscan.io",
    nativeSymbol: "SOL",
    viemChain: VIEM_CHAIN_STUBS.solana,
  },
};

export const EVM_CHAIN_KEYS: EvmChainKey[] = ["eth", "arbitrum", "polygon", "base", "bnb", "hyperevm"];
export const ALL_CHAIN_KEYS: ChainKey[] = [...EVM_CHAIN_KEYS, "solana"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get RPC URL for chain — primary + fallback
 * Element requires refinement: live RPC keys needed per env RPC_URL_* ; fallback is optional
 */
export function getRpcUrl(chain: ChainKey): string | null {
  const cfg = CHAIN_CONFIG[chain];
  if (!cfg) return null;
  const primary = (process.env[cfg.rpcEnvVar] || "").trim();
  if (primary) return primary;
  const fallback = (process.env[cfg.rpcFallbackEnvVar] || "").trim();
  if (fallback) return fallback;
  // Also try generic WORKER fallbacks? leave refinement
  return null;
}

/**
 * Get all configured RPC URLs for chain (primary + fallback if both set)
 * Used by worker fallback transport: viem fallback([http(primary), http(fallback)])
 */
export function getRpcUrls(chain: ChainKey): string[] {
  const cfg = CHAIN_CONFIG[chain];
  if (!cfg) return [];
  const out: string[] = [];
  const primary = (process.env[cfg.rpcEnvVar] || "").trim();
  if (primary) out.push(primary);
  const fallback = (process.env[cfg.rpcFallbackEnvVar] || "").trim();
  if (fallback) out.push(fallback);
  return out;
}

/**
 * Get required confirmations for chain
 */
export function getConfirmationsRequired(chain: ChainKey): number {
  const cfg = CHAIN_CONFIG[chain];
  if (!cfg) return 12;
  const raw = process.env[cfg.confirmationsEnv];
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 1 && v <= 1000) return Math.floor(v);
  return cfg.confirmationsDefault;
}

/**
 * Get poll interval ms (global)
 */
export function getWorkerPollMs(): number {
  const raw = process.env.WORKER_POLL_MS || process.env[cfgPollEnvFallback()];
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 1000 && v <= 120000) return Math.floor(v);
  return 15000;
}
function cfgPollEnvFallback(): string {
  return "WORKER_POLL_MS";
}

/**
 * Is EVM chain?
 */
export function isEvmChain(chain: string): boolean {
  return (EVM_CHAIN_KEYS as string[]).includes(chain);
}

/**
 * Is Solana chain?
 */
export function isSolanaChain(chain: string): boolean {
  return chain === "solana";
}

/**
 * Get explorer address URL for chain+address
 * Element requires refinement: HyperEVM explorer path may be /address/0x... or different — verify against official explorer
 */
export function getExplorerAddressUrl(chain: ChainKey, address: string): string {
  const cfg = CHAIN_CONFIG[chain];
  if (!cfg) return "#";
  // Solana uses /account/, EVM uses /address/
  if (chain === "solana") return `${cfg.explorerBaseUrl}/account/${address}`;
  // HyperEVM placeholder — Element requires refinement: confirm explorer base + path
  if (chain === "hyperevm") return `${cfg.explorerBaseUrl}/address/${address}`;
  return `${cfg.explorerBaseUrl}/address/${address}`;
}

/**
 * Get explorer tx URL for chain+hash
 */
export function getExplorerTxUrl(chain: ChainKey, txHash: string): string {
  const cfg = CHAIN_CONFIG[chain];
  if (!cfg) return "#";
  if (chain === "solana") return `${cfg.explorerBaseUrl}/tx/${txHash}`;
  if (chain === "hyperevm") return `${cfg.explorerBaseUrl}/tx/${txHash}`;
  return `${cfg.explorerBaseUrl}/tx/${txHash}`;
}

/**
 * Validate chain key
 */
export function isValidChain(chain: string): chain is ChainKey {
  return (ALL_CHAIN_KEYS as string[]).includes(chain);
}

/**
 * Payment addresses — read from env, fallback to spec constants
 * EVM same address across all 6 chains per spec
 */
export function getPaymentAddress(): string {
  return (
    process.env.PAYMENT_ADDRESS ||
    process.env.NEXT_PUBLIC_PAYMENT_ADDRESS ||
    process.env.NEXT_PUBLIC_EVM_ADDRESS ||
    process.env.NEXT_PUBLIC_BASE_ADDRESS ||
    "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786"
  );
}

export function getSolanaAddress(): string {
  return (
    process.env.SOLANA_ADDRESS ||
    process.env.NEXT_PUBLIC_SOL_ADDRESS ||
    process.env.NEXT_PUBLIC_SOLANA_ADDRESS ||
    "So11111111111111111111111111111111111111112"
  );
}

/**
 * Payment address for given chain
 */
export function getAddressForChain(chain: ChainKey): string {
  if (chain === "solana") return getSolanaAddress();
  return getPaymentAddress();
}

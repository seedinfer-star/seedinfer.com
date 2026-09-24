/**
 * lib/payments/qr.ts — EIP-681 and Solana Pay URI generators
 *
 * Pure helpers, no mocks, no extra deps.
 */

/**
 * Generate EIP-681 URI for ERC-20 transfer.
 *
 * @param chainId - EVM chain ID (e.g., 1, 8453)
 * @param tokenAddress - ERC-20 token contract address
 * @param toAddress - recipient wallet address
 * @param amountWei - amount in base units (uint256) as decimal string
 * @param invoiceId - optional invoice ID appended as memo
 * @returns EIP-681 URI: `ethereum:${tokenAddress}@${chainId}/transfer?address=${toAddress}&uint256=${amountWei}` plus `&memo=${invoiceId}` if provided
 */
export function generateEip681Uri(
  chainId: string | number,
  tokenAddress: string,
  toAddress: string,
  amountWei: string,
  invoiceId?: string
): string {
  const base = `ethereum:${tokenAddress}@${chainId}/transfer?address=${toAddress}&uint256=${amountWei}`;
  return invoiceId ? `${base}&memo=${encodeURIComponent(invoiceId)}` : base;
}

/**
 * Generate Solana Pay URI.
 *
 * @param recipient - Solana recipient address (base58)
 * @param amount - amount in UI units as decimal string
 * @param splToken - SPL token mint address
 * @param reference - reference public key (invoice id)
 * @param memo - memo string (invoice id)
 * @param label - wallet label (defaults to SeedInfer)
 * @returns Solana Pay URI: `solana:${recipient}?amount=${amount}&spl-token=${splToken}&reference=${reference}&memo=${memo}&label=SeedInfer`
 */
export function generateSolanaPayUri(
  recipient: string,
  amount: string,
  splToken: string,
  reference: string,
  memo: string,
  label = "SeedInfer"
): string {
  return `solana:${recipient}?amount=${amount}&spl-token=${splToken}&reference=${reference}&memo=${memo}&label=${encodeURIComponent(label)}`;
}

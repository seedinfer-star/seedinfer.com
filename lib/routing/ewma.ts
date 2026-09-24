/**
 * lib/routing/ewma.ts — EWMA (Exponentially Weighted Moving Average) dla TTFT/latency
 * alpha 0.2 → 80% historia, 20% nowy pomiar. Odporny na spike, szybka adaptacja do trendu.
 * Inspired by vllm-router / Finagle EWMA.
 */
export class EWMA {
  private alpha: number
  private value: number | null = null
  private initialized = false

  constructor(alpha = 0.2) {
    if (alpha <= 0 || alpha > 1) throw new Error(`EWMA alpha must be (0,1], got ${alpha}`)
    this.alpha = alpha
  }

  /** Aktualizuj EWMA nowym pomiarem (ms). Ignoruje NaN / <=0 */
  update(sample: number): number | null {
    if (!Number.isFinite(sample) || sample <= 0) return this.value
    // clamp extreme outliers >30s to avoid poisoning
    const clamped = Math.min(sample, 30_000)
    if (!this.initialized || this.value === null) {
      this.value = clamped
      this.initialized = true
    } else {
      this.value = this.alpha * clamped + (1 - this.alpha) * this.value
    }
    return this.value
  }

  /** Bieżąca wartość EWMA lub null jeśli brak pomiarów */
  get(): number | null {
    return this.value
  }

  /** Ustaw bezpośrednio (np. przy restore z store) */
  set(v: number | null): void {
    if (v === null || v === undefined) {
      this.value = null
      this.initialized = false
    } else if (Number.isFinite(v) && v > 0) {
      this.value = Math.min(v, 30_000)
      this.initialized = true
    }
  }

  reset(): void {
    this.value = null
    this.initialized = false
  }

  isInitialized(): boolean {
    return this.initialized
  }

  getAlpha(): number {
    return this.alpha
  }

  toJSON(): { alpha: number; value: number | null; initialized: boolean } {
    return { alpha: this.alpha, value: this.value, initialized: this.initialized }
  }

  static fromJSON(j: { alpha?: number; value: number | null }): EWMA {
    const e = new EWMA(j.alpha ?? 0.2)
    e.set(j.value)
    return e
  }
}

/** Helper: policz EWMA iteracyjnie bez klasy */
export function ewmaUpdate(prev: number | null, sample: number, alpha = 0.2): number {
  if (prev === null || prev === undefined) return Math.min(sample, 30_000)
  return alpha * Math.min(sample, 30_000) + (1 - alpha) * prev
}

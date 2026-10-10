/**
 * lib/routing/lease.ts — standalone in-memory lease store (KV reservation).
 * No deps except node builtins. Env-independent.
 */
import { randomUUID } from "node:crypto";

export interface Lease {
  id: string;
  nodeId: string;
  tokens: number;
  release: () => void;
}

export interface LeaseCounters {
  inFlight: number;
  activeKv: number;
}

interface LeaseEntry {
  id: string;
  nodeId: string;
  tokens: number;
  createdAt: number;
  released: boolean;
}

const leases = new Map<string, LeaseEntry>();
const LEASE_MAX_AGE_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

let sweeper: NodeJS.Timeout | null = null;

function ensureSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, e] of leases) {
      if (e.released) {
        leases.delete(id);
      } else if (now - e.createdAt > LEASE_MAX_AGE_MS) {
        e.released = true;
        leases.delete(id);
      }
    }
    if (leases.size === 0 && sweeper) {
      clearInterval(sweeper);
      sweeper = null;
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof (sweeper as unknown as { unref?: () => void }).unref === "function") {
    (sweeper as unknown as { unref: () => void }).unref();
  }
}

export function acquireLease(nodeId: string, tokens: number): Lease {
  const id = randomUUID();
  const entry: LeaseEntry = {
    id,
    nodeId: String(nodeId),
    tokens: Number(tokens),
    createdAt: Date.now(),
    released: false,
  };
  leases.set(id, entry);
  ensureSweeper();
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    entry.released = true;
    leases.delete(id);
  };
  return { id, nodeId: entry.nodeId, tokens: entry.tokens, release };
}

export function getLeaseCounters(nodeId: string): LeaseCounters {
  let inFlight = 0;
  let activeKv = 0;
  for (const e of leases.values()) {
    if (!e.released && e.nodeId === String(nodeId)) {
      inFlight += 1;
      activeKv += e.tokens;
    }
  }
  return { inFlight, activeKv };
}

export function listLeases(): Array<{ id: string; nodeId: string; tokens: number }> {
  const out: Array<{ id: string; nodeId: string; tokens: number }> = [];
  for (const e of leases.values()) {
    if (!e.released) out.push({ id: e.id, nodeId: e.nodeId, tokens: e.tokens });
  }
  return out;
}

export function leaseCount(): number {
  let n = 0;
  for (const e of leases.values()) {
    if (!e.released) n += 1;
  }
  return n;
}

export function resetLeases(): void {
  leases.clear();
  if (sweeper) {
    clearInterval(sweeper);
    sweeper = null;
  }
}

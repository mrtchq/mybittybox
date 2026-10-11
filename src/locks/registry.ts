// ─────────────────────────────────────────────────────────────────────────────
// src/locks/registry.ts
//
// Central lock registry + ceremony (combiner) engine.
//
// Phase 1 establishes the registry so every lock is discoverable by id and the
// Lock Combiner (Phase 6) can orchestrate any set of locks through one uniform
// `evaluateCeremony` call. The combiner tree is fully serializable to a compact
// URL-safe config (Phase 7).
// ─────────────────────────────────────────────────────────────────────────────

import {
  LockPlugin,
  LockContext,
  LockEvaluation,
  fail,
  pass,
} from './types';
import { passcodeLock } from './plugins/passcodeLock';
import { passphraseLock } from './plugins/passphraseLock';
import { timeWindowLock } from './plugins/timeWindowLock';
import { burnAfterReadingLock } from './plugins/burnAfterReadingLock';
import { maxOpensLock } from './plugins/maxOpensLock';
import { accessWindowLock } from './plugins/accessWindowLock';
import { countdownLock } from './plugins/countdownLock';
import { tapToUnsealLock } from './plugins/tapToUnsealLock';
import { inviteCodeLock } from './plugins/inviteCodeLock';
import { qrProximityLock } from './plugins/qrProximityLock';
import { puzzleLock } from './plugins/puzzleLock';
import { proofOfHumanLock } from './plugins/proofOfHumanLock';
import { browserKeyLock } from './plugins/browserKeyLock';
import { paymentLock } from './plugins/paymentLock';
import { serverStubLocks } from './plugins/serverStubLocks';

// ── Registry ────────────────────────────────────────────────────────────────
const REGISTRY = new Map<string, LockPlugin>();

function register(plugin: LockPlugin): void {
  if (REGISTRY.has(plugin.id)) {
    throw new Error(`Duplicate lock id registered: ${plugin.id}`);
  }
  REGISTRY.set(plugin.id, plugin);
}

// Seed the registry with all Tier-1 locks (proven against existing crypto
// primitives). Tiers 2–4 register their plugins here as they land.
register(passcodeLock);
register(passphraseLock);
register(timeWindowLock);
register(burnAfterReadingLock);
register(maxOpensLock);
register(accessWindowLock);
register(countdownLock);
register(tapToUnsealLock);

// Phase 6.5 — Wave 1 client-evaluable locks (no backend).
register(inviteCodeLock);
register(qrProximityLock);
register(puzzleLock);
register(proofOfHumanLock);
register(browserKeyLock);
register(paymentLock);

// Wave 1 server-gated stubs: clickable but always-pass until their backend ships.
for (const stub of serverStubLocks) register(stub);

export function getLock(id: string): LockPlugin | undefined {
  return REGISTRY.get(id);
}

export function allLocks(): LockPlugin[] {
  return Array.from(REGISTRY.values());
}

export function registerLock(plugin: LockPlugin): void {
  register(plugin);
}

// ── Ceremony (Lock Combiner) model ────────────────────────────────────────────
//
// A ceremony is a tree: leaf nodes are single locks; internal nodes combine
// children with AND/OR. Phase 6 builds the UI; this is the evaluation core.
export type CeremonyLogic = 'AND' | 'OR';

export interface CeremonyNode {
  /** Leaf: the lock id. */
  lockId?: string;
  /** Leaf: the lock's creator config. */
  config?: Record<string, unknown>;
  /** Internal: logic combining children. */
  logic?: CeremonyLogic;
  /** Internal: child nodes. */
  children?: CeremonyNode[];
}

export interface CeremonyResult {
  passed: boolean;
  /** Per-lock verdicts keyed by lockId (multiple instances deduped by index). */
  leaves: { lockId: string; evaluation: LockEvaluation }[];
  logic: CeremonyLogic | 'LEAF';
}

/**
 * Recursively evaluate a ceremony tree against a context map keyed by lockId.
 * Each leaf pulls its attempt from `attempts[lockId]`. Pure; no IO.
 */
export async function evaluateCeremony(
  node: CeremonyNode,
  attempts: Record<string, LockContext>,
  nowMs: number = Date.now(),
): Promise<CeremonyResult> {
  if (node.lockId) {
    const plugin = getLock(node.lockId);
    if (!plugin) {
      return { passed: false, leaves: [], logic: 'LEAF' };
    }
    const ctx: LockContext = { ...(attempts[node.lockId] ?? {}), nowMs };
    const evaluation = await plugin.evaluate(node.config ?? {}, ctx);
    return {
      passed: evaluation.passed,
      leaves: [{ lockId: node.lockId, evaluation }],
      logic: 'LEAF',
    };
  }

  const logic = node.logic ?? 'AND';
  const childResults = await Promise.all(
    (node.children ?? []).map((c) => evaluateCeremony(c, attempts, nowMs)),
  );
  const passed =
    logic === 'AND'
      ? childResults.every((r) => r.passed)
      : childResults.some((r) => r.passed);

  return {
    passed,
    leaves: childResults.flatMap((r) => r.leaves),
    logic,
  };
}

// ── Serialization (Phase 7 URL-resident contract) ─────────────────────────────
// Compact, base64url-encoded JSON. Sensitive lock fields must already be hashed
// by the plugin before config is serialized (see bittyCrypto envelope usage).

export function serializeCeremony(node: CeremonyNode): string {
  const json = JSON.stringify(node);
  // minimal URL-safe base64 (browser btoa works on Latin1; JSON is ASCII here)
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function deserializeCeremony(encoded: string): CeremonyNode {
  const json = decodeURIComponent(escape(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
  return JSON.parse(json) as CeremonyNode;
}

export { pass, fail };

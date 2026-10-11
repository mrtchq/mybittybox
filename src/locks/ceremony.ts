// ─────────────────────────────────────────────────────────────────────────────
// src/locks/ceremony.ts
//
// Phase 1.5 — Integration Bridge.
//
// Box-level glue between the URL-resident ceremony (a serialized lock tree on
// BittyMetadata.ceremony) and the registry engine. This is the seam the live
// app calls: pass it the encoded ceremony + a map of visitor attempts, get back
// pass/fail + per-leaf verdicts + which unlock animation to play.
//
// No legacy compatibility shims — Bitty Box is in testing mode and the old
// ad-hoc lockConfig.timeWindow / openLimit path is being superseded by this
// engine wholesale.
// ─────────────────────────────────────────────────────────────────────────────

import {
  CeremonyNode,
  CeremonyResult,
  deserializeCeremony,
  evaluateCeremony,
  getLock,
} from './registry';
import { LockContext } from './types';

export type UnlockAnimation = 'shatter' | 'dissolve' | 'vault-door' | 'burn' | 'scan' | 'none';

export interface BoxCeremonyEvaluation extends CeremonyResult {
  /** Animation to play on unlock, inherited from the first passing leaf plugin. */
  animation: UnlockAnimation;
  /** Hints aggregated from any failing leaves, for UI surfacing. */
  failingHints: string[];
  /**
   * The credential candidate (passcode/passphrase) to use when decrypting the
   * box's own `cipher=` payload. Undefined for non-credential ceremonies.
   */
  candidate?: string;
}

/** Decode a ceremony string to a tree. Returns null if absent or corrupt. */
export function parseCeremony(encoded?: string | null): CeremonyNode | null {
  if (!encoded || encoded.length > 32768) return null;
  try {
    const node = deserializeCeremony(encoded);
    const ids = new Set<string>();
    let count = 0;
    const valid = (value: unknown, depth: number): boolean => {
      if (++count > 64 || depth > 8 || !value || typeof value !== 'object' || Array.isArray(value)) return false;
      const n = value as CeremonyNode;
      if (n.lockId !== undefined) {
        if (typeof n.lockId !== 'string' || !getLock(n.lockId) || ids.has(n.lockId) || n.logic !== undefined || n.children !== undefined) return false;
        if (n.config !== undefined && (!n.config || typeof n.config !== 'object' || Array.isArray(n.config))) return false;
        ids.add(n.lockId);
        return true;
      }
      return (n.logic === 'AND' || n.logic === 'OR') && Array.isArray(n.children)
        && n.children.length > 0 && n.children.every(child => valid(child, depth + 1));
    };
    return valid(node, 0) ? node : null;
  } catch {
    return null;
  }
}

/**
 * Evaluate a box's ceremony against the visitor's attempts.
 * A missing/empty ceremony means the box is open (no gate).
 */
export async function evaluateBoxCeremony(
  encoded: string | undefined | null,
  attempts: Record<string, LockContext>,
  nowMs: number = Date.now(),
): Promise<BoxCeremonyEvaluation> {
  const node = parseCeremony(encoded);
  if (!node) {
    return { passed: !encoded, leaves: [], logic: 'LEAF', animation: 'none',
      failingHints: encoded ? ['Invalid or unsupported ceremony. Ask the creator for a new link.'] : [] };
  }

  const res: CeremonyResult = await evaluateCeremony(node, attempts, nowMs);

  // Recover each leaf's creator config (the CeremonyResult type drops it) so we
  // can surface accurate hints instead of interpolating an undefined value.
  const configByLock = new Map<string, Record<string, unknown>>();
  const collect = (n: CeremonyNode) => {
    if (n.lockId) { configByLock.set(n.lockId, (n.config ?? {}) as Record<string, unknown>); }
    else { (n.children ?? []).forEach(collect); }
  };
  collect(node);

  let animation: UnlockAnimation = 'none';
  const failingHints: string[] = [];
  for (const leaf of res.leaves) {
    const plugin = getLock(leaf.lockId);
    if (plugin && leaf.evaluation.passed && animation === 'none') {
      animation = plugin.animation as UnlockAnimation;
    }
    if (!leaf.evaluation.passed && plugin) {
      try {
        failingHints.push(...plugin.getHints(configByLock.get(leaf.lockId) ?? {}));
      } catch {
        /* getHints is best-effort */
      }
    }
  }

  // Surface a credential candidate (box-level passcode/passphrase gate) so the
  // caller can decrypt the box's own `cipher=` payload.
  let candidate: string | undefined;
  for (const leaf of res.leaves) {
    const c = leaf.evaluation.progress?.candidate;
    if (typeof c === 'string' && c && !candidate) candidate = c;
  }

  return { ...res, animation, failingHints, candidate };
}

/**
 * Aggregate the creator hints for every leaf in a ceremony (best-effort).
 * Surfaced by the LockGate "SHOW HINTS" toggle. Never reveals secrets.
 */
export function ceremonyHints(encoded?: string | null): string[] {
  const node = parseCeremony(encoded);
  if (!node) return [];
  const out: string[] = [];
  const walk = (n: CeremonyNode) => {
    if (n.lockId) {
      const plugin = getLock(n.lockId);
      if (plugin) {
        try {
          out.push(...plugin.getHints((n.config ?? {}) as Record<string, unknown>));
        } catch {
          /* getHints is best-effort */
        }
      }
    } else {
      (n.children ?? []).forEach(walk);
    }
  };
  walk(node);
  return out;
}

export interface CeremonyLeaf {
  lockId: string;
  name: string;
  description: string;
  icon: string;
  /** Schema fields that map to visitor input (ctx.input). Empty = no input needed. */
  inputFields: { key: string; label: string; type: string; placeholder?: string }[];
  /** True when this leaf needs a live-evaluated (no-input) gate, e.g. time locks. */
  autoGate: boolean;
}

/**
 * Flatten a ceremony tree to its leaf locks for UI rendering. Assumes unique
 * lockId per leaf (ceremonies with duplicate lockIds would collide in the
 * attempt map — not supported in v1).
 */
export function ceremonyLeaves(encoded?: string | null): CeremonyLeaf[] {
  const node = parseCeremony(encoded);
  if (!node) return [];
  const out: CeremonyLeaf[] = [];
  const walk = (n: CeremonyNode) => {
    if (n.lockId) {
      const plugin = getLock(n.lockId);
      if (plugin) {
        const inputFields = plugin.schema
          .filter((f) => ['text', 'password', 'email', 'number'].includes(f.type))
          .map((f) => ({ key: f.key, label: f.label, type: f.type, placeholder: f.placeholder }));
        out.push({
          lockId: n.lockId,
          name: plugin.name,
          description: plugin.description,
          icon: plugin.icon,
          inputFields,
          autoGate: inputFields.length === 0,
        });
      }
    } else {
      (n.children ?? []).forEach(walk);
    }
  };
  walk(node);
  return out;
}

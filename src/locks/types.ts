// ─────────────────────────────────────────────────────────────────────────────
// src/locks/types.ts
//
// Core Lock Architecture (Phase 1) — the universal plugin contract.
//
// Every one of the 25 programmable lock types is expressed as a `LockPlugin`.
// This file is the single source of truth for the contract. Tiers 1–4 and the
// Lock Combiner (Phase 6) all consume plugins through these types — no lock is
// ever special-cased in the engine.
//
// Design notes:
//  - `evaluate` is PURE and client-runnable. It must not perform network IO, so
//    URL-resident locks (time, passcode, passphrase, tap, countdown, puzzle
//    solution, etc.) can be checked entirely in the browser from the URL hash.
//  - Locks that fundamentally need server state (burn-after-reading, approval,
//    payment, device-pairing, dead-man-switch) declare `requiresServer: true`
//    and a `serverCheck` hook; the engine degrades them to a clear
//    "server-required" UI (Phase 7) when no backend is present.
//  - `validate` checks a *creator-supplied config* for correctness at build time
//    (e.g. passcode length). `evaluate` checks a *visitor attempt* at open time.
// ─────────────────────────────────────────────────────────────────────────────

/** Broad capability category, used for the Lock Lab grid tags. */
export type LockCategory =
  | 'IDENTITY'        // needs who-you-are (email, wallet, signed sender)
  | 'CREDENTIAL'      // something you know (passcode, passphrase, invite)
  | 'TIME'            // temporal gating
  | 'BEHAVIORAL'     // actions/gestures/sequences
  | 'SOCIAL'          // other people / multi-party
  | 'PROOF'           // knowledge/proof challenges (TOTP, puzzle, PoW)
  | 'PAYMENT'         // money
  | 'ENVIRONMENT';    // browser/device/location context

/** Optional metadata tags from the spec (OBJECT REQUIRED, COMMERCIAL TRUST, etc.). */
export type LockTag =
  | 'OBJECT REQUIRED'
  | 'IDENTITY'
  | 'COMMERCIAL TRUST'
  | 'SERVER REQUIRED'
  | 'URL RESIDENT'
  | 'MOBILE FRIENDLY';

/** The runtime context passed to evaluate(). Kept minimal + serializable-ish. */
export interface LockContext {
  /** Visitor-supplied input for this attempt (code, email, signature, etc.). */
  input?: unknown;
  /** Current wall-clock time (injectable for tests). */
  nowMs?: number;
  /** Browser geolocation, when the lock needs it. */
  coords?: { lat: number; lng: number } | null;
  /** Device fingerprint / pairing token from localStorage. */
  deviceToken?: string | null;
  /** A pre-resolved server verdict, when the engine ran a serverCheck. */
  serverVerdict?: boolean | null;
  /** Misc per-attempt state (e.g. tap sequence so far). */
  [key: string]: unknown;
}

export type LockStatus = 'LOCKED' | 'UNLOCKED' | 'PENDING' | 'EXPIRED' | 'SERVER_REQUIRED' | 'FAILED';

/** Result of a single lock evaluation. */
export interface LockEvaluation {
  status: LockStatus;
  /** Human-facing reason (why locked / what's missing). Surfaced in the UI. */
  reason?: string;
  /** True only when the gate should open. */
  passed: boolean;
  /** Opaque data the lock may persist across attempts (e.g. tap progress). */
  progress?: Record<string, unknown>;
}

/**
 * Declarative schema for a creator-facing config field. Drives the
 * auto-generated per-lock configuration form (Phase 9) and validation.
 */
export interface LockFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'datetime-local' | 'select' | 'toggle' | 'email';
  placeholder?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: { value: string; label: string }[];
  help?: string;
  /** For 'number': clamp. */
  min?: number;
  max?: number;
}

export interface LockPlugin<C = Record<string, unknown>> {
  /** Stable, URL-safe identifier (e.g. "passcode", "totp", "location"). */
  id: string;
  /** Display name shown in the Lock Lab grid + lock card. */
  name: string;
  /** One-line description for the Lock Lab spec list. */
  description: string;
  category: LockCategory;
  tags: LockTag[];
  /** Whether this lock can be fully evaluated client-side from the URL. */
  urlResident: boolean;
  /** Whether this lock needs a server/KV backend to function. */
  requiresServer: boolean;
  /** Auto-generated config form schema (Phase 9). */
  schema: LockFieldSchema[];
  /** Lucide icon name (resolved by the UI layer). */
  icon: string;
  /** Animation key played on successful unlock (Phase 8). */
  animation: 'shatter' | 'dissolve' | 'vault-door' | 'burn' | 'scan' | 'none';
  /** Build-time validation of creator config. Returns errors (empty = ok). */
  validate(config: C): string[];
  /** Hint(s) shown when a visitor is stuck (never reveals the secret). */
  getHints(config: C): string[];
  /** Open-time evaluation of a visitor attempt. PURE — no network. */
  evaluate(config: C, ctx: LockContext): LockEvaluation | Promise<LockEvaluation>;
  /**
   * Optional server-side verdict function. Only invoked by the engine when a
   * backend is available. Returns whether the lock should open.
   */
  serverCheck?(config: C, ctx: LockContext): Promise<boolean> | boolean;
  /**
   * Optional side-effect the box engine runs AFTER a successful unlock
   * (e.g. mark a burn-after-reading flag consumed, bump a max-opens counter).
   * Called once per reveal; must be safe to no-op when no storage is present.
   */
  onUnlock?(config: C, ctx: LockContext): void | Promise<void>;
}

/** Helper: a failed evaluation with a reason. */
export function fail(reason: string, progress?: Record<string, unknown>): LockEvaluation {
  return { status: 'FAILED', passed: false, reason, progress };
}
export function pass(progress?: Record<string, unknown>): LockEvaluation {
  return { status: 'UNLOCKED', passed: true, progress };
}
export function locked(reason: string, progress?: Record<string, unknown>): LockEvaluation {
  return { status: 'LOCKED', passed: false, reason, progress };
}

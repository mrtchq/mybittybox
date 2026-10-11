// ─────────────────────────────────────────────────────────────────────────────
// src/locks/combiner.ts
//
// Phase 6 — Lock Combiner (pure, UI-agnostic helpers).
//
// The engine already knows how to evaluate + serialize a ceremony tree. What
// the creator-side builder needs is a clean way to assemble that tree from a
// flat list of leaf selections, choose AND/OR logic, seed sensible per-lock
// defaults, and declare the ceremony-appropriate config fields for each lock.
//
// Everything here is PURE (no React, no DOM) so it is unit-testable in
// isolation via `node --test` + `tsx`, exactly like the rest of the lock
// subsystem.
// ─────────────────────────────────────────────────────────────────────────────

import { CeremonyNode, serializeCeremony } from './registry';
import { LockFieldSchema } from './types';

/** Locks whose leaf gates the box's own `cipher=` payload (no separate envelope). */
export const CREDENTIAL_LOCK_IDS = new Set<string>(['passcode', 'passphrase']);

/** The AND/OR logic available at the ceremony root in v1. */
export type CombinerLogic = 'AND' | 'OR';

export interface CombinerLeaf {
  lockId: string;
  config: Record<string, unknown>;
}

/**
 * A ceremony-appropriate description of one configurable field on a leaf.
 * This is NOT the plugin `schema` verbatim — credential locks are expressed
 * as box-level (the secret is the box password, never stored in the tree),
 * and consume-tracking locks get a stable boxId so their fallback counts
 * are per-box rather than global.
 */
export interface CombinerField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle' | 'datetime-local' | 'email';
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  default?: string | number | boolean;
}

const genBoxId = (): string =>
  `bbx_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

/** Per-lock ceremony config fields (keyed by lock id). */
export const COMBINER_FIELDS: Record<string, CombinerField[]> = {
  passcode: [
    { key: 'minLength', label: 'Min length', type: 'number', min: 4, max: 64, default: 8 },
    { key: 'hint', label: 'Hint (optional)', type: 'text', placeholder: 'e.g. your birthday', default: '' },
  ],
  passphrase: [
    { key: 'minWords', label: 'Min words', type: 'number', min: 1, max: 20, default: 2 },
    { key: 'caseInsensitive', label: 'Case insensitive', type: 'toggle', default: false },
    { key: 'hint', label: 'Hint (optional)', type: 'text', placeholder: 'e.g. favourite quote', default: '' },
  ],
  'time-window': [
    { key: 'notBefore', label: 'Unlocks at (UTC)', type: 'datetime-local', default: '' },
    { key: 'notAfter', label: 'Locks at (UTC)', type: 'datetime-local', default: '' },
    { key: 'showCountdown', label: 'Show countdown', type: 'toggle', default: true },
  ],
  'access-window': [
    { key: 'startHour', label: 'Start hour (0–23)', type: 'number', min: 0, max: 23, default: 9 },
    { key: 'startMin', label: 'Start minute', type: 'number', min: 0, max: 59, default: 0 },
    { key: 'endHour', label: 'End hour (0–23)', type: 'number', min: 0, max: 23, default: 17 },
    { key: 'endMin', label: 'End minute', type: 'number', min: 0, max: 59, default: 0 },
    {
      key: 'timezone', label: 'Timezone', type: 'select',
      options: [{ value: 'local', label: 'Local' }, { value: 'utc', label: 'UTC' }],
      default: 'local',
    },
  ],
  countdown: [
    { key: 'durationSec', label: 'Countdown (seconds)', type: 'number', min: 1, max: 86400, default: 60 },
  ],
  'tap-to-unseal': [
    { key: 'taps', label: 'Required taps', type: 'number', min: 1, max: 50, default: 3 },
    { key: 'windowMs', label: 'Window (ms, 0 = off)', type: 'number', min: 0, max: 60000, default: 0 },
  ],
  'burn-after-reading': [
    { key: 'boxId', label: 'Box ID (consume tracking)', type: 'text', default: '' },
    { key: 'serverRequired', label: 'Server-enforced', type: 'toggle', default: false },
  ],
  'max-opens': [
    { key: 'boxId', label: 'Box ID (count tracking)', type: 'text', default: '' },
    { key: 'max', label: 'Max opens', type: 'number', min: 1, max: 100000, default: 5 },
    { key: 'serverRequired', label: 'Server-enforced', type: 'toggle', default: false },
  ],
  'invite-code': [
    { key: 'code', label: 'Invite code', type: 'text', placeholder: 'e.g. VIP-2026', default: '' },
    { key: 'caseInsensitive', label: 'Case insensitive', type: 'toggle', default: true },
    { key: 'hint', label: 'Hint (optional)', type: 'text', placeholder: 'shown to visitor', default: '' },
  ],
  'qr-proximity': [
    { key: 'expected', label: 'Expected QR/NFC value', type: 'text', placeholder: 'code the tag carries', default: '' },
  ],
  puzzle: [
    { key: 'riddle', label: 'Riddle / prompt', type: 'text', placeholder: 'e.g. I speak without a mouth…', default: '' },
    { key: 'answer', label: 'Answer', type: 'text', default: '' },
    { key: 'caseInsensitive', label: 'Case insensitive', type: 'toggle', default: true },
  ],
  'proof-of-human': [
    { key: 'ms', label: 'Hold duration (ms)', type: 'number', min: 300, max: 10000, default: 1500 },
  ],
  'browser-key': [
    { key: 'token', label: 'Key seed', type: 'text', placeholder: 'auto-bound on first open', default: '' },
  ],
  payment: [
    { key: 'checkoutUrl', label: 'Creem checkout URL', type: 'text', placeholder: 'https://www.creem.io/checkout/...', default: '' },
    { key: 'expectedSession', label: 'Expected session id', type: 'text', placeholder: 'cs_test_… or order id', default: '' },
  ],
  totp: [{ key: 'issuer', label: 'Issuer', type: 'text', default: 'Bitty Box' }],
  'signed-sender': [{ key: 'creatorKey', label: 'Creator public key', type: 'text', default: '' }],
  'recipient-email': [{ key: 'email', label: 'Recipient email', type: 'email', default: '' }],
  'wallet-signature': [{ key: 'chain', label: 'Chain', type: 'select', options: [{ value: 'eth', label: 'Ethereum' }, { value: 'sol', label: 'Solana' }], default: 'eth' }],
  approval: [{ key: 'note', label: 'Approval note', type: 'text', default: '' }],
  'two-person': [{ key: 'threshold', label: 'Keyholders required', type: 'number', min: 2, max: 9, default: 2 }],
  'dead-man-switch': [{ key: 'intervalH', label: 'Liveness interval (h)', type: 'number', min: 1, max: 8760, default: 72 }],
  location: [{ key: 'radiusM', label: 'Radius (m)', type: 'number', min: 1, max: 100000, default: 100 }],
  'device-pairing': [{ key: 'deviceLabel', label: 'Device label', type: 'text', default: '' }],
  'chain-key': [{ key: 'parentBox', label: 'Parent box id', type: 'text', default: '' }],
  'one-time-magic-key': [{ key: 'keyRef', label: 'Key ref', type: 'text', default: '' }],
};

/**
 * Seed a leaf's default config for a lock id. Credential locks are box-level
 * by default (their `boxLevel` flag is injected at tree-build time so the
 * secret never enters the serialized tree). Consume-tracking locks get a fresh
 * stable boxId so fallback counts are per-box.
 */
export function defaultLeafConfig(lockId: string): Record<string, unknown> {
  const fields = COMBINER_FIELDS[lockId] ?? [];
  const cfg: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default !== undefined && f.default !== '') cfg[f.key] = f.default;
  }
  if (lockId === 'burn-after-reading' || lockId === 'max-opens') {
    cfg.boxId = genBoxId();
  }
  return cfg;
}

/**
 * Finalize a leaf's config for serialization:
 *  - credential locks get `boxLevel: true` (secret is the box password, not stored)
 *  - countdown gets `startTs = now` so the visitor countdown begins at publish time
 */
export function finalizeLeafConfig(lockId: string, config: Record<string, unknown>, nowMs: number = Date.now()): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  if (CREDENTIAL_LOCK_IDS.has(lockId)) {
    out.boxLevel = true;
    delete out.envelope;
  }
  if (lockId === 'countdown' && (out.startTs == null || Number(out.startTs) <= 0)) {
    out.startTs = nowMs;
  }
  return out;
}

/** Strip empty-string values so optional fields don't serialize as noise. */
function compactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (v === '' || v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Build a ceremony tree from flat leaf selections. Returns null when no leaves
 * are present (no gate). One leaf → bare leaf node; 2+ → root logic node.
 */
export function buildCeremonyTree(leaves: CombinerLeaf[], logic: CombinerLogic): CeremonyNode | null {
  if (leaves.length === 0) return null;
  const children: CeremonyNode[] = leaves.map((leaf) => ({
    lockId: leaf.lockId,
    config: compactConfig(finalizeLeafConfig(leaf.lockId, leaf.config)),
  }));
  if (children.length === 1) return children[0];
  return { logic, children };
}

/** Serialize the builder's flat selections to the URL-resident ceremony string. */
export function buildCeremony(leaves: CombinerLeaf[], logic: CombinerLogic): string | null {
  const node = buildCeremonyTree(leaves, logic);
  return node ? serializeCeremony(node) : null;
}

/** True when a credential lock is selected — the box must be encrypted with `boxPassword`. */
export function hasCredentialLeaf(leaves: CombinerLeaf[]): boolean {
  return leaves.some((l) => CREDENTIAL_LOCK_IDS.has(l.lockId));
}

/** Convert {@link CombinerField} to a LockFieldSchema-shaped object (for reuse in forms). */
export function toLockFieldSchema(field: CombinerField): LockFieldSchema {
  return {
    key: field.key,
    label: field.label,
    type: field.type as LockFieldSchema['type'],
    placeholder: field.placeholder,
    help: field.help,
    min: field.min,
    max: field.max,
    options: field.options,
  };
}
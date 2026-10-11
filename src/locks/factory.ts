// ─────────────────────────────────────────────────────────────────────────────
// src/locks/factory.ts
//
// Shared builders for the "variant" locks so Phases 2–5 stay DRY and consistent.
// Most of the 25 locks reduce to one of two primitives:
//   • HASH-COMPARE  — visitor attempt is hashed (salted SHA-256) and matched to a
//                     stored hash. Zero-knowledge: only the hash lives in the URL.
//   • TIME-GATE     — a pure Date.now() comparison against stored bounds.
// Stronger locks (passcode/passphrase) keep the PBKDF2 envelope from bittyCrypto.
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, fail, locked, pass } from './types';

function subtleCrypto(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) throw new Error('Web Crypto unavailable');
  return c.subtle;
}

/** SHA-256 hex digest (for comparison-based locks). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await subtleCrypto().digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normalize an attempt: trim + optional lowercase. */
export function normalizeAttempt(
  input: string,
  opts: { caseInsensitive?: boolean } = {},
): string {
  let s = typeof input === 'string' ? input : '';
  s = s.trim();
  if (opts.caseInsensitive) s = s.toLowerCase();
  return s;
}

export interface HashLockConfig {
  /** Stored SHA-256 hex of (salt + secret). Creator-side hashed — never plaintext. */
  hash?: string;
  /** Optional per-box salt mixed into the hash to defeat precomputation. */
  salt?: string;
  caseInsensitive?: boolean;
  hint?: string;
}

/**
 * Build a lock that opens when the visitor's attempt hashes to `config.hash`.
 * Pure, URL-resident, zero-knowledge. Powers invite-code / email-allowlist /
 * magic-key locks in later tiers with zero bespoke code.
 */
export function defineHashLock(meta: {
  id: string;
  name: string;
  description: string;
  category: LockPlugin['category'];
  tags?: LockPlugin['tags'];
  icon: string;
  animation?: LockPlugin['animation'];
  help?: string;
}): LockPlugin<HashLockConfig> {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    category: meta.category,
    tags: meta.tags ?? ['URL RESIDENT'],
    urlResident: true,
    requiresServer: false,
    icon: meta.icon,
    animation: meta.animation ?? 'shatter',
    schema: [
      {
        key: 'hash',
        label: 'Secret hash (SHA-256)',
        type: 'password',
        required: true,
        help: meta.help ?? 'Hash of the accepted secret; never store the plaintext.',
      },
      { key: 'salt', label: 'Salt (optional)', type: 'text' },
      { key: 'caseInsensitive', label: 'Case insensitive', type: 'toggle' },
      { key: 'hint', label: 'Hint (optional)', type: 'text' },
    ],
    validate(config) {
      const errors: string[] = [];
      if (!config.hash || !/^[0-9a-f]{64}$/i.test(config.hash)) {
        errors.push('hash must be a 64-char hex SHA-256.');
      }
      return errors;
    },
    getHints(config) {
      return config.hint ? [config.hint] : ['Enter the correct secret to unlock.'];
    },
    async evaluate(config, ctx): Promise<LockEvaluation> {
      const raw = typeof ctx.input === 'string' ? ctx.input : '';
      if (!raw) return locked('Enter the required secret.');
      const norm = normalizeAttempt(raw, { caseInsensitive: config.caseInsensitive });
      const candidate = await sha256Hex((config.salt ?? '') + norm);
      if (candidate === config.hash) return pass();
      return fail('Incorrect secret. Try again.');
    },
  };
}

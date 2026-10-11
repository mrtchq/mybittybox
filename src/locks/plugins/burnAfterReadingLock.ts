// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/burnAfterReadingLock.ts
// Lock #4 (Tier 1): Burn-After-Reading Lock.
// Single-use. After the first successful unlock the secret is destroyed.
// Server KV is the authoritative store (requiresServer: true); in URL /
// no-backend mode we degrade to a localStorage flag so the Lab UI still works.
// The engine calls `onUnlock` to mark consumption.
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, locked, fail, pass } from '../types';

export interface BurnConfig {
  boxId?: string;
  serverRequired?: boolean;
}

const consumedKey = (id?: string) => `bb:burn:${id ?? 'anon'}`;

export const burnAfterReadingLock: LockPlugin<BurnConfig> = {
  id: 'burn-after-reading',
  name: 'Burn-After-Reading Lock',
  description:
    'Single-use. After first successful unlock the secret is destroyed. KV preferred; localStorage fallback in URL mode.',
  category: 'BEHAVIORAL',
  tags: ['OBJECT REQUIRED', 'SERVER REQUIRED'],
  urlResident: false,
  requiresServer: true,
  icon: 'Flame',
  animation: 'burn',
  schema: [{ key: 'boxId', label: 'Box ID (consume tracking)', type: 'text' }],
  validate(config) {
    const errors: string[] = [];
    if (!config.boxId) errors.push('Need a boxId to track consumption.');
    return errors;
  },
  getHints() {
    return ['This secret can only be opened once.'];
  },
  evaluate(config, ctx): LockEvaluation {
    // Server mode: honor the engine-resolved verdict.
    if (config.serverRequired && ctx.serverVerdict == null) {
      return { status: 'SERVER_REQUIRED', passed: false, reason: 'A backend is required to enforce single-use.' };
    }
    if (ctx.serverVerdict === false) return fail('This secret has already been opened.');
    // localStorage fallback (URL mode / no backend).
    try {
      const k = consumedKey(config.boxId);
      if (typeof localStorage !== 'undefined' && localStorage.getItem(k)) {
        return fail('This secret has already been opened.');
      }
    } catch {
      /* storage unavailable — fall through to open */
    }
    return pass();
  },
  onUnlock(config) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(consumedKey(config.boxId), String(Date.now()));
    } catch {
      /* ignore */
    }
  },
};

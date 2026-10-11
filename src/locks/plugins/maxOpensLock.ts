// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/maxOpensLock.ts
// Lock #5 (Tier 1): Max Opens Lock.
// Like burn-after-reading but configurable (e.g. 5 opens max). Tracks an open
// count. Server KV is authoritative (requiresServer: true); localStorage
// fallback in URL mode. Engine calls `onUnlock` to bump the counter.
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, locked, fail, pass } from '../types';

export interface MaxOpensConfig {
  boxId?: string;
  max?: number;
  serverRequired?: boolean;
}

const countKey = (id?: string) => `bb:maxopens:${id ?? 'anon'}`;

export const maxOpensLock: LockPlugin<MaxOpensConfig> = {
  id: 'max-opens',
  name: 'Max Opens Lock',
  description: 'Like burn-after-reading but configurable (e.g. 5 opens). Tracks open count; localStorage fallback in URL mode.',
  category: 'BEHAVIORAL',
  tags: ['OBJECT REQUIRED', 'SERVER REQUIRED'],
  urlResident: false,
  requiresServer: true,
  icon: 'Repeat',
  animation: 'burn',
  schema: [
    { key: 'boxId', label: 'Box ID', type: 'text' },
    { key: 'max', label: 'Max opens', type: 'number', min: 1, max: 100000 },
  ],
  validate(config) {
    const errors: string[] = [];
    if (!config.boxId) errors.push('Need boxId.');
    if (!config.max || config.max < 1) errors.push('max must be ≥ 1.');
    return errors;
  },
  getHints(config) {
    return [`Opens remaining tracked per box (max ${config.max ?? '?'}).`];
  },
  evaluate(config, ctx): LockEvaluation {
    if (config.serverRequired && ctx.serverVerdict == null) {
      return { status: 'SERVER_REQUIRED', passed: false, reason: 'A backend is required to track open counts.' };
    }
    if (ctx.serverVerdict === false) return fail('Open limit reached.');
    try {
      const k = countKey(config.boxId);
      if (typeof localStorage !== 'undefined') {
        const used = Number(localStorage.getItem(k) ?? '0');
        if (used >= (config.max ?? 1)) return fail('Open limit reached.');
      }
    } catch {
      /* storage unavailable */
    }
    return pass();
  },
  onUnlock(config) {
    try {
      if (typeof localStorage !== 'undefined') {
        const k = countKey(config.boxId);
        localStorage.setItem(k, String(Number(localStorage.getItem(k) ?? '0') + 1));
      }
    } catch {
      /* ignore */
    }
  },
};

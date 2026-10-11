// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/tapToUnsealLock.ts
// Lock #8 (Tier 1): Tap-to-Unseal Lock.
// Requires N taps/clicks within a time window. Mobile-friendly gesture
// validation. The UI collects tap timestamps and passes them as ctx.input.
// Pure given the input array — URL-resident.
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, locked, pass, fail } from '../types';

export interface TapConfig {
  taps?: number;
  windowMs?: number;
}

export const tapToUnsealLock: LockPlugin<TapConfig> = {
  id: 'tap-to-unseal',
  name: 'Tap-to-Unseal Lock',
  description: 'Requires N taps/clicks within a time window. Mobile-friendly gesture validation, URL-resident.',
  category: 'BEHAVIORAL',
  tags: ['URL RESIDENT', 'MOBILE FRIENDLY'],
  urlResident: true,
  requiresServer: false,
  icon: 'Hand',
  animation: 'shatter',
  schema: [
    { key: 'taps', label: 'Required taps', type: 'number', min: 1, max: 50 },
    { key: 'windowMs', label: 'Window (ms)', type: 'number', min: 100 },
  ],
  validate(config) {
    const errors: string[] = [];
    if (!config.taps) errors.push('Set required taps.');
    return errors;
  },
  getHints(config) {
    return [`Tap ${config.taps ?? '?'} times${config.windowMs ? ` within ${config.windowMs}ms` : ''}.`];
  },
  evaluate(config, ctx): LockEvaluation {
    const times = Array.isArray(ctx.input) ? (ctx.input as number[]) : [];
    const need = config.taps ?? 1;
    const win = config.windowMs ?? 0;
    if (times.length < need) return locked(`Taps: ${times.length}/${need}.`);
    if (win > 0) {
      const span = (times[times.length - 1] as number) - (times[0] as number);
      if (span > win) return fail('Too slow — start the sequence over.');
    }
    return pass();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/countdownLock.ts
// Lock #7 (Tier 1): Countdown Unlock Lock.
// Opens only after a countdown hits zero. No early bypass — pure time gate,
// URL-resident (startTs + durationSec stored in the URL).
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, locked, pass } from '../types';

export interface CountdownConfig {
  /** Epoch ms when the countdown started (creator-side, in the URL). */
  startTs?: number;
  /** Countdown length in seconds. */
  durationSec?: number;
}

export const countdownLock: LockPlugin<CountdownConfig> = {
  id: 'countdown',
  name: 'Countdown Unlock Lock',
  description: 'Opens only after a countdown hits zero. No early bypass — pure time gate, URL-resident.',
  category: 'TIME',
  tags: ['URL RESIDENT', 'MOBILE FRIENDLY'],
  urlResident: true,
  requiresServer: false,
  icon: 'Timer',
  animation: 'dissolve',
  schema: [
    { key: 'startTs', label: 'Start timestamp (ms epoch)', type: 'number' },
    { key: 'durationSec', label: 'Duration (seconds)', type: 'number', min: 1 },
  ],
  validate(config) {
    const errors: string[] = [];
    if (!config.startTs || !config.durationSec) errors.push('Need startTs and durationSec.');
    return errors;
  },
  getHints(config) {
    const remain = (config.startTs ?? 0) + (config.durationSec ?? 0) * 1000 - Date.now();
    return remain > 0 ? [`Unlocks in ${Math.ceil(remain / 1000)}s.`] : ['Countdown complete — unlocked.'];
  },
  evaluate(config, ctx): LockEvaluation {
    const now = ctx.nowMs ?? Date.now();
    const openAt = (config.startTs ?? 0) + (config.durationSec ?? 0) * 1000;
    if (now < openAt) return locked(`Unlocks in ${Math.ceil((openAt - now) / 1000)}s.`);
    return pass();
  },
};

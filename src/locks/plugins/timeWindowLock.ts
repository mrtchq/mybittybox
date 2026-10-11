// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/timeWindowLock.ts
//
// Lock: Time Capsule / Window (Tier 1 #3 + existing Step #2 primitive).
//
// Wraps src/utils/timeWindow.ts so the time gate is a first-class plugin in the
// uniform lock contract. Pure, URL-resident (timestamps live in the URL hash).
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, locked, pass } from '../types';
import {
  TimeWindowConfig,
  evaluateTimeWindow,
  nextBoundary,
  formatCountdown,
} from '../../utils/timeWindow';

export interface TimeWindowLockConfig {
  enabled?: boolean;
  notBefore?: string | null;
  notAfter?: string | null;
  showCountdown?: boolean;
}

export const timeWindowLock: LockPlugin<TimeWindowLockConfig> = {
  id: 'time-window',
  name: 'Time Capsule Lock',
  description:
    'Opens only after a set datetime (or within a window). Validate Date.now() >= unlockTime; unlock time stored URL-resident.',
  category: 'TIME',
  tags: ['URL RESIDENT', 'OBJECT REQUIRED'],
  urlResident: true,
  requiresServer: false,
  icon: 'Hourglass',
  animation: 'dissolve',
  schema: [
    {
      key: 'notBefore',
      label: 'Unlocks at (UTC)',
      type: 'datetime-local',
      help: 'Box stays sealed until this time.',
    },
    {
      key: 'notAfter',
      label: 'Locks at (UTC)',
      type: 'datetime-local',
      help: 'Box self-seals after this time.',
    },
    { key: 'showCountdown', label: 'Show countdown', type: 'toggle' },
  ],

  validate(config) {
    const errors: string[] = [];
    if (config.notBefore && config.notAfter) {
      const nb = Date.parse(config.notBefore);
      const na = Date.parse(config.notAfter);
      if (!Number.isNaN(nb) && !Number.isNaN(na) && nb > na) {
        errors.push('Unlocks-at must be before Locks-at.');
      }
    }
    return errors;
  },

  getHints(config) {
    const { kind, ms } = nextBoundary(
      { enabled: true, notBefore: config.notBefore, notAfter: config.notAfter },
      evaluateTimeWindow({ enabled: true, notBefore: config.notBefore, notAfter: config.notAfter }),
    );
    if (kind && ms != null) {
      return [`This lock ${kind === 'unlocks' ? 'unlocks' : 'expires'} in ${formatCountdown(ms)}.`];
    }
    return ['This lock is time-gated.'];
  },

  evaluate(config, ctx): LockEvaluation {
    const status = evaluateTimeWindow(
      { enabled: true, notBefore: config.notBefore, notAfter: config.notAfter },
      ctx.nowMs ?? Date.now(),
    );
    switch (status) {
      case 'OPEN':
        return pass();
      case 'PENDING':
        return locked('Not yet unlocked — wait for the capsule to open.');
      case 'EXPIRED':
        return locked('This capsule has sealed permanently.');
      default:
        return pass();
    }
  },
};

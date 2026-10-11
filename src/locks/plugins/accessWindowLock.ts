// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/accessWindowLock.ts
// Lock #6 (Tier 1): Access Window Lock.
// Recurring daily time range (e.g. 9:00–17:00). Validates on every attempt.
// Pure, URL-resident — no server needed.
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, locked, pass } from '../types';

export interface AccessWindowConfig {
  startHour?: number;
  startMin?: number;
  endHour?: number;
  endMin?: number;
  timezone?: 'local' | 'utc';
}

function minuteOfDay(d: Date, utc: boolean): number {
  return (utc ? d.getUTCHours() : d.getHours()) * 60 + (utc ? d.getUTCMinutes() : d.getMinutes());
}

function hhmm(h?: number, m?: number): string {
  return `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export const accessWindowLock: LockPlugin<AccessWindowConfig> = {
  id: 'access-window',
  name: 'Access Window Lock',
  description:
    'Opens only within a recurring daily time range (e.g. 9:00–17:00). Validates on each attempt, URL-resident.',
  category: 'TIME',
  tags: ['URL RESIDENT', 'MOBILE FRIENDLY'],
  urlResident: true,
  requiresServer: false,
  icon: 'Clock',
  animation: 'dissolve',
  schema: [
    { key: 'startHour', label: 'Start hour (0–23)', type: 'number', min: 0, max: 23 },
    { key: 'startMin', label: 'Start minute', type: 'number', min: 0, max: 59 },
    { key: 'endHour', label: 'End hour (0–23)', type: 'number', min: 0, max: 23 },
    { key: 'endMin', label: 'End minute', type: 'number', min: 0, max: 59 },
    {
      key: 'timezone',
      label: 'Timezone',
      type: 'select',
      options: [
        { value: 'local', label: 'Local' },
        { value: 'utc', label: 'UTC' },
      ],
    },
  ],
  validate(config) {
    const errors: string[] = [];
    if (config.startHour == null || config.endHour == null) errors.push('Set start and end hours.');
    return errors;
  },
  getHints(config) {
    return [`Opens between ${hhmm(config.startHour, config.startMin)} and ${hhmm(config.endHour, config.endMin)}.`];
  },
  evaluate(config, ctx): LockEvaluation {
    const now = new Date(ctx.nowMs ?? Date.now());
    const utc = config.timezone === 'utc';
    const cur = minuteOfDay(now, utc);
    const start = (config.startHour ?? 0) * 60 + (config.startMin ?? 0);
    const end = (config.endHour ?? 0) * 60 + (config.endMin ?? 0);
    if (cur < start) return locked(`Opens at ${hhmm(config.startHour, config.startMin)}.`);
    if (cur > end) return locked('Closed for the day — try again during the access window.');
    return pass();
  },
};

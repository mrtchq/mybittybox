// src/locks/plugins/inviteCodeLock.ts
// Lock #15 — Invite-Code Lock (client-verified, URL-resident).
import { LockPlugin, LockContext, LockEvaluation, fail, locked, pass } from '../types';

export interface InviteCodeConfig {
  code?: string;
  caseInsensitive?: boolean;
}

export const inviteCodeLock: LockPlugin<InviteCodeConfig> = {
  id: 'invite-code',
  name: 'Invite-Code Lock',
  description: 'Gated by a shared or quota-bounded invite code. Client-verified.',
  category: 'CREDENTIAL',
  tags: ['URL RESIDENT'],
  urlResident: true,
  requiresServer: false,
  icon: 'Ticket',
  animation: 'vault-door',
  schema: [
    { key: 'code', label: 'Invite code', type: 'text', required: true, placeholder: 'e.g. VIP-2026' },
    { key: 'caseInsensitive', label: 'Case insensitive', type: 'toggle', default: true },
  ],
  validate(c) {
    if (!c.code || !c.code.trim()) return ['Set an invite code.'];
    return [];
  },
  getHints(c) {
    const shown = c.caseInsensitive ? (c.code ?? '').toLowerCase() : (c.code ?? '');
    return [`Enter the invite code: ${shown || '(not set)'}`];
  },
  evaluate(c, ctx): LockEvaluation {
    const attempt = typeof ctx.input === 'string' ? ctx.input : '';
    if (!attempt) return locked('Enter the invite code to unlock.');
    const want = c.caseInsensitive ? (c.code ?? '').toLowerCase() : (c.code ?? '');
    const got = c.caseInsensitive ? attempt.toLowerCase() : attempt;
    return got === want ? pass() : fail('Wrong invite code.');
  },
};

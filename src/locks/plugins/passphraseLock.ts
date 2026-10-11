// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/passphraseLock.ts
// Lock #2 (Tier 1): Passphrase Lock.
// Multi-word passphrase. Case-insensitive option + hint support. Reuses the
// zero-knowledge PBKDF2 envelope from bittyCrypto (same strength as passcode).
// ─────────────────────────────────────────────────────────────────────────────

import { LockPlugin, LockContext, LockEvaluation, fail, locked } from '../types';
import { decryptBox, WrongPasswordError } from '../../utils/bittyCrypto';

export interface PassphraseConfig {
  envelope?: string;
  hint?: string;
  caseInsensitive?: boolean;
  minWords?: number;
  /**
   * Box-level gating mode (see passcodeLock.boxLevel). When true and no
   * envelope is bound, gates the box's `cipher=` payload and surfaces the
   * candidate via progress.candidate.
   */
  boxLevel?: boolean;
}

export const passphraseLock: LockPlugin<PassphraseConfig> = {
  id: 'passphrase',
  name: 'Passphrase Lock',
  description:
    'Multi-word passphrase. Case-insensitive option + hint. PBKDF2 envelope, fully URL-resident.',
  category: 'CREDENTIAL',
  tags: ['URL RESIDENT', 'OBJECT REQUIRED'],
  urlResident: true,
  requiresServer: false,
  icon: 'Quote',
  animation: 'vault-door',
  schema: [
    { key: 'envelope', label: 'Encryption envelope', type: 'password', required: true },
    { key: 'caseInsensitive', label: 'Case insensitive', type: 'toggle' },
    { key: 'minWords', label: 'Min words', type: 'number', min: 1, max: 20 },
    { key: 'hint', label: 'Hint (optional)', type: 'text' },
  ],
  validate(config) {
    const errors: string[] = [];
    if (!config.envelope) errors.push('Missing encryption envelope.');
    return errors;
  },
  getHints(config) {
    return config.hint ? [config.hint] : ['Enter the passphrase set by the creator.'];
  },
  async evaluate(config, ctx): Promise<LockEvaluation> {
    let attempt = typeof ctx.input === 'string' ? ctx.input : '';
    if (config.caseInsensitive) attempt = attempt.toLowerCase();
    if (!attempt) return locked('Enter the passphrase to unlock.');
    if (config.minWords && attempt.trim().split(/\s+/).filter(Boolean).length < config.minWords) {
      return fail(`Passphrase needs at least ${config.minWords} words.`);
    }
    if (!config.envelope) {
      if (config.boxLevel) {
        if (!attempt) return locked('Enter the passphrase to unlock.');
        const words = attempt.trim().split(/\s+/).filter(Boolean).length;
        if (config.minWords && words < config.minWords) {
          return fail(`Passphrase needs at least ${config.minWords} words.`);
        }
        return { status: 'UNLOCKED', passed: true, progress: { candidate: attempt } };
      }
      return locked('This lock is not yet bound to an encrypted payload.');
    }
    try {
      const decrypted = await decryptBox(config.envelope, attempt);
      return { status: 'UNLOCKED', passed: true, progress: { decrypted } };
    } catch (err) {
      if (err instanceof WrongPasswordError) return fail('Incorrect passphrase. Try again.');
      return fail('Unable to verify passphrase.');
    }
  },
};

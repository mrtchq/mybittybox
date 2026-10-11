// ─────────────────────────────────────────────────────────────────────────────
// src/locks/plugins/passcodeLock.ts
//
// Lock #1 (Tier 1): Passcode Lock.
//
// Uses the existing zero-knowledge envelope in src/utils/bittyCrypto.ts. The
// passcode is NEVER stored in the URL — only the PBKDF2+AES-GCM envelope is.
// Validation is simply: does the visitor's attempt decrypt the envelope? That is
// handled by the box content layer (bittyEngine), but the lock *contract* here
// gates the unlock UI and records intent. The `config` carries the envelope
// reference; `ctx.input` is the attempted passcode.
//
// For URL-resident mode, the envelope already lives in the URL hash. This plugin
// evaluates by attempting decryption and reporting success/failure.
// ─────────────────────────────────────────────────────────────────────────────

import {
  LockPlugin,
  LockContext,
  LockEvaluation,
  fail,
  locked,
} from '../types';
import { decryptBox, WrongPasswordError } from '../../utils/bittyCrypto';

export interface PasscodeConfig {
  /** The base64url envelope produced by encryptBox(). Stored in the URL hash. */
  envelope?: string;
  /** UI hint toggle (never reveals the code). */
  hint?: string;
  minLength?: number;
  /**
   * Box-level gating mode. When true and no envelope is bound, this leaf gates
   * the box's own `cipher=` payload: it only verifies the visitor supplied a
   * candidate of sufficient length and surfaces it via progress.candidate. It
   * does NOT attempt to decrypt its own envelope (there isn't one).
   */
  boxLevel?: boolean;
}

export const passcodeLock: LockPlugin<PasscodeConfig> = {
  id: 'passcode',
  name: 'Passcode Lock',
  description:
    'Simple numeric or alphanumeric code validation. Salt+hash (PBKDF2) stored URL-resident — zero server knowledge.',
  category: 'CREDENTIAL',
  tags: ['URL RESIDENT', 'OBJECT REQUIRED'],
  urlResident: true,
  requiresServer: false,
  icon: 'KeyRound',
  animation: 'vault-door',
  schema: [
    {
      key: 'envelope',
      label: 'Encryption envelope',
      type: 'password',
      required: true,
      help: 'Output of encryptBox() — the encrypted payload, safe to embed in the URL.',
    },
    { key: 'hint', label: 'Hint (optional)', type: 'text', placeholder: 'e.g. birthday' },
    { key: 'minLength', label: 'Min code length', type: 'number', min: 1, max: 64 },
  ],

  validate(config) {
    const errors: string[] = [];
    if (!config.envelope || config.envelope.trim().length === 0) {
      errors.push('Missing encryption envelope — generate it via encryptBox().');
    }
    if (config.minLength != null && config.minLength < 1) {
      errors.push('minLength must be ≥ 1.');
    }
    return errors;
  },

  getHints(config) {
    return config.hint ? [config.hint] : ['Enter the passcode set by the creator.'];
  },

  async evaluate(config, ctx): Promise<LockEvaluation> {
    const attempt = typeof ctx.input === 'string' ? ctx.input : '';
    if (!attempt) return locked('Enter the passcode to unlock.');

    if (config.minLength != null && attempt.length < config.minLength) {
      return fail(`Passcode must be at least ${config.minLength} characters.`);
    }

    // The envelope may live in config OR be resolved from the URL by the caller.
    const envelope = config.envelope;
    if (!envelope) {
      if (config.boxLevel) {
        // Box-level gate: validate the candidate, hand it up for cipher= decrypt.
        if (!attempt) return locked('Enter the passcode to unlock.');
        if (config.minLength != null && attempt.length < config.minLength) {
          return fail(`Passcode must be at least ${config.minLength} characters.`);
        }
        return { status: 'UNLOCKED', passed: true, progress: { candidate: attempt } };
      }
      // No envelope bound yet (creator preview). Treat as a structural gate only.
      return locked('This lock is not yet bound to an encrypted payload.');
    }

    try {
      // A successful decrypt proves the passcode is correct. The decrypted bytes
      // are handed back via progress for the box layer to render.
      const decrypted = await decryptBox(envelope, attempt);
      return {
        status: 'UNLOCKED',
        passed: true,
        progress: { decrypted },
      };
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        return fail('Incorrect passcode. Try again.');
      }
      return fail('Unable to verify passcode.');
    }
  },
};

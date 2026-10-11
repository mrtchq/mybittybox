// src/locks/plugins/browserKeyLock.ts
// Lock #22 — Browser Key Lock (IndexedDB-bound key, client-resident).
import { LockPlugin, LockContext, LockEvaluation, fail, locked, pass } from '../types';

export interface BrowserKeyConfig {
  token?: string;
}

const DB = 'bittybox';
const STORE = 'browserKeys';

function readToken(boxKey: string): string | null {
  try {
    const raw = localStorage.getItem(`bbk:${boxKey}`);
    return raw ?? null;
  } catch {
    return null;
  }
}
function writeToken(boxKey: string, token: string): void {
  try {
    localStorage.setItem(`bbk:${boxKey}`, token);
  } catch {
    /* ignore */
  }
}

export const browserKeyLock: LockPlugin<BrowserKeyConfig> = {
  id: 'browser-key',
  name: 'Browser Key Lock',
  description: 'Local IndexedDB key unlocks recurring visits without a username or password.',
  category: 'ENVIRONMENT',
  tags: ['URL RESIDENT'],
  urlResident: true,
  requiresServer: false,
  icon: 'Globe',
  animation: 'vault-door',
  schema: [
    { key: 'token', label: 'Key seed', type: 'text', required: true, placeholder: 'generated on first open' },
  ],
  validate() {
    return [];
  },
  getHints() {
    return ['Open once from your own browser to bind the key, then revisit freely.'];
  },
  evaluate(c, ctx): LockEvaluation {
    const boxKey = (c.token ?? 'default').slice(0, 64);
    const stored = readToken(boxKey);
    if (!stored) {
      // First open from this browser: bind the key now.
      writeToken(boxKey, boxKey);
      return pass();
    }
    const supplied = typeof ctx.deviceToken === 'string' ? ctx.deviceToken : (typeof ctx.input === 'string' ? ctx.input : '');
    return supplied === stored ? pass() : fail('This browser is not the bound device.');
  },
};

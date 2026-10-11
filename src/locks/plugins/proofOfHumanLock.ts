// src/locks/plugins/proofOfHumanLock.ts
// Lock #24 — Proof-of-Human Lock (client-only hold gesture; bot-deterrent).
import { LockPlugin, LockContext, LockEvaluation, fail, locked, pass } from '../types';

export interface ProofOfHumanConfig {
  ms?: number;
}

export const proofOfHumanLock: LockPlugin<ProofOfHumanConfig> = {
  id: 'proof-of-human',
  name: 'Proof-of-Human Lock',
  description: 'Interactive hold gesture that deters bots. Client-only (no server PoW).',
  category: 'PROOF',
  tags: ['URL RESIDENT'],
  urlResident: true,
  requiresServer: false,
  icon: 'Fingerprint',
  animation: 'scan',
  schema: [
    { key: 'ms', label: 'Hold duration (ms)', type: 'number', min: 300, max: 10000, default: 1500 },
  ],
  validate() {
    return [];
  },
  getHints() {
    return ['Press and hold the button until it verifies you are human.'];
  },
  evaluate(c, ctx): LockEvaluation {
    const dur = Number(ctx.input);
    if (!dur || Number.isNaN(dur)) return locked('Hold the button to prove you are human.');
    return dur >= (c.ms ?? 1500) ? pass() : fail('Hold the button longer to verify.');
  },
};

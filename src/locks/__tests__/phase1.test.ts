// ─────────────────────────────────────────────────────────────────────────────
// src/locks/__tests__/phase1.test.ts
//
// Phase 1 verification: registry integrity, plugin contract, ceremony eval.
// Runs under `node --test` via tsx (no extra test deps required):
//   npx tsx --test src/locks/__tests__/phase1.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLock,
  allLocks,
  evaluateCeremony,
  serializeCeremony,
  deserializeCeremony,
} from '../registry';
import type { CeremonyNode, LockContext } from '../registry';
import { passcodeLock } from '../plugins/passcodeLock';
import { timeWindowLock } from '../plugins/timeWindowLock';
import { encryptBox } from '../../utils/bittyCrypto';

test('registers foundational locks', () => {
  assert.ok(getLock('passcode'));
  assert.ok(getLock('time-window'));
  assert.ok(allLocks().length >= 2);
});

test('every registered plugin satisfies the contract shape', () => {
  for (const p of allLocks()) {
    assert.equal(typeof p.id, 'string');
    assert.equal(typeof p.evaluate, 'function');
    assert.equal(typeof p.validate, 'function');
    assert.equal(typeof p.getHints, 'function');
    assert.ok(Array.isArray(p.schema));
    assert.ok(p.tags.every((t) => typeof t === 'string'));
  }
});

test('passcode lock fails closed on wrong input, opens on correct', async () => {
  const env = await encryptBox('top secret', 'correct-horse');
  const evalBad = await passcodeLock.evaluate({ envelope: env }, { input: 'wrong' } as LockContext);
  assert.equal(evalBad.passed, false);

  const evalGood = await passcodeLock.evaluate({ envelope: env }, { input: 'correct-horse' } as LockContext);
  assert.equal(evalGood.passed, true);
});

test('time-window lock gates by timestamp', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  const pending = await timeWindowLock.evaluate({ notBefore: future }, {});
  assert.equal(pending.passed, false);
  assert.equal(pending.status, 'LOCKED');

  const open = await timeWindowLock.evaluate({ notAfter: future }, {});
  assert.equal(open.passed, true);

  const expired = await timeWindowLock.evaluate({ notBefore: past, notAfter: past }, {});
  assert.equal(expired.passed, false);
});

test('ceremony AND requires all leaves; OR requires one', async () => {
  const env = await encryptBox('x', 'pw');
  const attempts: Record<string, LockContext> = {
    passcode: { input: 'pw' },
    'time-window': {},
  };
  const andTree: CeremonyNode = {
    logic: 'AND',
    children: [
      { lockId: 'passcode', config: { envelope: env } },
      { lockId: 'time-window', config: { notAfter: new Date(Date.now() + 99999).toISOString() } },
    ],
  };
  const andRes = await evaluateCeremony(andTree, attempts);
  assert.equal(andRes.passed, true);

  const orTree: CeremonyNode = {
    logic: 'OR',
    children: [
      { lockId: 'passcode', config: { envelope: env } },
      { lockId: 'time-window', config: { notBefore: new Date(Date.now() + 99999).toISOString() } },
    ],
  };
  const orRes = await evaluateCeremony(orTree, attempts);
  assert.equal(orRes.passed, true);
});

test('ceremony serializes + deserializes losslessly', () => {
  const node: CeremonyNode = {
    logic: 'AND',
    children: [
      { lockId: 'passcode', config: { envelope: 'abc' } },
      { lockId: 'time-window', config: { notAfter: '2026-01-01T00:00:00.000Z' } },
    ],
  };
  const round = deserializeCeremony(serializeCeremony(node));
  assert.deepEqual(round, node);
});

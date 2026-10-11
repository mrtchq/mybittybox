// ─────────────────────────────────────────────────────────────────────────────
// src/locks/__tests__/ceremony.test.ts
//
// Phase 1.5 verification: the box-level ceremony bridge.
//   - serialize/deserialize round-trip
//   - evaluateBoxCeremony AND / OR at box level
//   - parseCeremony null-safety on garbage
//   - boxLevel credential gate surfaces a candidate (decrypt hand-off)
//   - ceremonyLeaves flattens correctly
//
// Runs under node --test via tsx:
//   npx tsx --test src/locks/__tests__/ceremony.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeCeremony,
  deserializeCeremony,
  type CeremonyNode,
} from '../registry';
import {
  evaluateBoxCeremony,
  ceremonyLeaves,
  parseCeremony,
  ceremonyHints,
} from '../ceremony';
import type { LockContext } from '../types';

const andNode: CeremonyNode = {
  logic: 'AND',
  children: [
    { lockId: 'time-window', config: { notAfter: new Date(Date.now() + 60_000).toISOString() } },
    { lockId: 'countdown', config: { startTs: Date.now() - 5000, durationSec: 1 } },
  ],
};

test('serialize/deserialize round-trips a tree', () => {
  const enc = serializeCeremony(andNode);
  const back = deserializeCeremony(enc);
  assert.deepEqual(back, andNode);
});

test('evaluateBoxCeremony passes an all-open AND tree', async () => {
  const enc = serializeCeremony(andNode);
  const res = await evaluateBoxCeremony(enc, {});
  assert.equal(res.passed, true);
  assert.equal(res.leaves.length, 2);
});

test('evaluateBoxCeremony fails AND when one leaf is locked', async () => {
  const node: CeremonyNode = {
    logic: 'AND',
    children: [
      { lockId: 'time-window', config: { notBefore: new Date(Date.now() + 60_000).toISOString() } },
      { lockId: 'countdown', config: { startTs: Date.now() - 5000, durationSec: 1 } },
    ],
  };
  const enc = serializeCeremony(node);
  const res = await evaluateBoxCeremony(enc, {});
  assert.equal(res.passed, false);
  assert.ok(res.failingHints.length >= 1);
});

test('evaluateBoxCeremony passes OR when any leaf opens', async () => {
  const node: CeremonyNode = {
    logic: 'OR',
    children: [
      { lockId: 'time-window', config: { notBefore: new Date(Date.now() + 60_000).toISOString() } },
      { lockId: 'countdown', config: { startTs: Date.now() - 5000, durationSec: 1 } },
    ],
  };
  const enc = serializeCeremony(node);
  const res = await evaluateBoxCeremony(enc, {});
  assert.equal(res.passed, true);
});

test('parseCeremony is null-safe on garbage / empty', () => {
  assert.equal(parseCeremony(null), null);
  assert.equal(parseCeremony(''), null);
  assert.equal(parseCeremony('@@@not-base64@@@'), null);
});

test('evaluateBoxCeremony returns open when ceremony is absent', async () => {
  const res = await evaluateBoxCeremony(undefined, {});
  assert.equal(res.passed, true);
  assert.equal(res.animation, 'none');
});

test('boxLevel passcode leaf surfaces a candidate (decrypt hand-off)', async () => {
  const node: CeremonyNode = {
    lockId: 'passcode',
    config: { boxLevel: true, minLength: 4 },
  };
  const enc = serializeCeremony(node);
  const attempts: Record<string, LockContext> = { passcode: { input: '1234' } };
  const res = await evaluateBoxCeremony(enc, attempts);
  assert.equal(res.passed, true);
  assert.equal(res.candidate, '1234');
});

test('boxLevel passcode leaf fails closed on short input', async () => {
  const node: CeremonyNode = { lockId: 'passcode', config: { boxLevel: true, minLength: 6 } };
  const enc = serializeCeremony(node);
  const attempts: Record<string, LockContext> = { passcode: { input: '123' } };
  const res = await evaluateBoxCeremony(enc, attempts);
  assert.equal(res.passed, false);
  assert.equal(res.candidate, undefined);
});

test('ceremonyLeaves flattens a 2-leaf AND tree', () => {
  const enc = serializeCeremony(andNode);
  const leaves = ceremonyLeaves(enc);
  assert.equal(leaves.length, 2);
  assert.ok(leaves.some((l) => l.lockId === 'time-window'));
  assert.ok(leaves.some((l) => l.lockId === 'countdown'));
});

test('ceremonyHints aggregates non-empty hints', () => {
  const enc = serializeCeremony(andNode);
  const hints = ceremonyHints(enc);
  assert.ok(hints.length >= 2);
  assert.ok(hints.every((h) => typeof h === 'string' && h.length > 0));
});

// ─────────────────────────────────────────────────────────────────────────────
// src/locks/__tests__/combiner.test.ts
//
// Phase 6 — pure builder helpers. Runs under `node --test` via tsx:
//   npx tsx --test src/locks/__tests__/combiner.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCeremonyTree,
  buildCeremony,
  defaultLeafConfig,
  finalizeLeafConfig,
  hasCredentialLeaf,
  COMBINER_FIELDS,
} from '../combiner';
import { deserializeCeremony } from '../registry';

test('empty selection yields no ceremony', () => {
  assert.equal(buildCeremony([], 'AND'), null);
  assert.equal(buildCeremonyTree([], 'AND'), null);
});

test('single leaf produces a bare leaf node without logic wrapper', () => {
  const node = buildCeremonyTree(
    [{ lockId: 'tap-to-unseal', config: { taps: 3 } }],
    'AND',
  );
  assert.ok(node);
  assert.equal(node.lockId, 'tap-to-unseal');
  assert.equal(node.logic, undefined);
  assert.equal(node.children, undefined);
});

test('two leaves produce a root logic node with both children', () => {
  const node = buildCeremonyTree(
    [
      { lockId: 'tap-to-unseal', config: { taps: 2 } },
      { lockId: 'time-window', config: { notAfter: '2099-01-01T00:00' } },
    ],
    'OR',
  );
  assert.ok(node);
  assert.equal(node.logic, 'OR');
  assert.equal(node.children?.length, 2);
});

test('credential leaf is injected boxLevel and drops any stray envelope', () => {
  const cfg = finalizeLeafConfig('passcode', { envelope: 'secret', minLength: 8 });
  assert.equal(cfg.boxLevel, true);
  assert.equal('envelope' in cfg, false);
  assert.equal(cfg.minLength, 8);
});

test('countdown leaf gets a startTs at publish time', () => {
  const cfg = finalizeLeafConfig('countdown', { durationSec: 30 }, 1700000000000);
  assert.equal(cfg.startTs, 1700000000000);
  assert.equal(cfg.durationSec, 30);
});

test('default configs seed sensible values and a stable boxId for consume-trackers', () => {
  const passcode = defaultLeafConfig('passcode');
  assert.equal(passcode.minLength, 8);

  const burn = defaultLeafConfig('burn-after-reading');
  assert.ok(burn.boxId);
  assert.ok(String(burn.boxId).startsWith('bbx_'));
});

test('hasCredentialLeaf detects box-level credential locks', () => {
  assert.equal(hasCredentialLeaf([{ lockId: 'passcode', config: {} }]), true);
  assert.equal(hasCredentialLeaf([{ lockId: 'tap-to-unseal', config: {} }]), false);
});

test('buildCeremony round-trips losslessly through deserializeCeremony', () => {
  const tree = buildCeremony(
    [
      { lockId: 'passcode', config: { minLength: 8 } },
      { lockId: 'tap-to-unseal', config: { taps: 2 } },
    ],
    'AND',
  );
  assert.ok(tree);
  // No display-only ellipsis corruption; the serialized string is intact.
  assert.equal(tree.includes('...'), false);
  const decoded = deserializeCeremony(tree);
  assert.equal(decoded.logic, 'AND');
  assert.equal(decoded.children?.length, 2);
  const passcode = decoded.children?.[0];
  assert.equal(passcode?.lockId, 'passcode');
  assert.equal(passcode?.config?.boxLevel, true);
  assert.equal(passcode?.config?.minLength, 8);
});

test('every registered Tier-1 lock has combiner fields', () => {
  for (const id of [
    'passcode', 'passphrase', 'time-window', 'burn-after-reading',
    'max-opens', 'access-window', 'countdown', 'tap-to-unseal',
  ]) {
    assert.ok(COMBINER_FIELDS[id], `${id} should have combiner fields`);
    assert.ok(Array.isArray(COMBINER_FIELDS[id]));
  }
});
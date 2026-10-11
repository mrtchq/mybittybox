import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBoxCeremony, ceremonyLeaves, parseCeremony } from '../ceremony';
import { serializeCeremony } from '../registry';

test('present but corrupt, empty, unknown, or ambiguous ceremony trees fail closed', async () => {
  const bad = [
    '@@@broken@@@', serializeCeremony({}), serializeCeremony({ logic: 'AND', children: [] }),
    serializeCeremony({ lockId: 'unknown-lock' }),
    serializeCeremony({ logic: 'OR', children: [{ lockId: 'countdown', config: { startTs: 0, durationSec: 1 } }, { lockId: 'unknown-lock' }] }),
    serializeCeremony({ logic: 'AND', children: [{ lockId: 'tap-to-unseal' }, { lockId: 'tap-to-unseal' }] }),
    btoa('null'), btoa('[]'), btoa('{"children":"oops"}'),
  ];
  for (const encoded of bad) {
    assert.equal((await evaluateBoxCeremony(encoded, {})).passed, false, encoded);
    assert.equal(parseCeremony(encoded), null);
    assert.deepEqual(ceremonyLeaves(encoded), []);
  }
});

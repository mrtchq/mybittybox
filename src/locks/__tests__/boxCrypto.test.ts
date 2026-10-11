import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressContent, decompressBittyData, buildBittyUrl } from '../../utils/bittyEngine';
import { serializeCeremony } from '../registry';

test('ZK ceremony URL authenticates before decoding compressed UTF-8 content', async () => {
  const content = '<h1>Sealed café 🔐</h1>';
  const payload = await compressContent(content, { password: '12345678', zk: true });
  const url = buildBittyUrl(payload.compressedUrl, {
    title: 'Sealed fixture', ceremony: serializeCeremony({ lockId: 'passcode', config: { boxLevel: true } }),
  }, 'https://bittybox.org');
  const hash = new URL(url).hash;
  const missing = await decompressBittyData(hash);
  assert.equal(missing.needsPassword, true, 'encrypted ZK bytes must not be treated as plaintext');
  assert.equal(missing.content, '');
  const wrong = await decompressBittyData(hash, '00000000');
  assert.equal(wrong.needsPassword, true);
  assert.equal(wrong.content, '');
  assert.match(wrong.error!, /incorrect/i);
  const right = await decompressBittyData(hash, '12345678');
  assert.equal(right.error, undefined);
  assert.equal(right.isEncrypted, true);
  assert.equal(right.needsPassword, false);
  assert.equal(right.content, content);
});

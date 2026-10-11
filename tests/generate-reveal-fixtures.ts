import { writeFileSync } from 'node:fs';
import { compressContent, buildBittyUrl } from '../src/utils/bittyEngine';
import { serializeCeremony } from '../src/locks/registry';
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#050515;color:#a4fff3;font-family:system-ui;padding:2rem"><h1>REVEAL VERIFIED</h1><p>This is a synthetic Lock Lab test transmission.</p></body></html>';
const credential = serializeCeremony({ lockId: 'passcode', config: { boxLevel: true, minLength: 8 } });
const encrypted = await compressContent(html, { password: '12345678', zk: true });
const plain = await compressContent(html);
const fixtures = {
  credential: buildBittyUrl(encrypted.compressedUrl, { title: 'Lock Lab Test', ceremony: credential }, ''),
  tap: buildBittyUrl(plain.compressedUrl, { title: 'Tap Test', ceremony: serializeCeremony({ lockId: 'tap-to-unseal', config: { taps: 1 } }) }, ''),
  corrupt: buildBittyUrl(plain.compressedUrl, { title: 'Corrupt Test', ceremony: '@@@broken@@@' }, ''),
  noLock: buildBittyUrl(plain.compressedUrl, { title: 'No Lock Test' }, ''),
};
writeFileSync('/root/backups/bittybox-reveal/fixtures.json', JSON.stringify(fixtures, null, 2));
console.log('Synthetic test fixtures generated. Public fixture passcode: 12345678.');

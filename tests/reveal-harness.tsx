import React from 'react';
import { createRoot } from 'react-dom/client';
import { BittyRenderer } from '../src/components/BittyRenderer';
import { compressContent, buildBittyUrl, parseBittyHash } from '../src/utils/bittyEngine';
import { serializeCeremony, getLock } from '../src/locks/registry';
import '../src/index.css';

const root = createRoot(document.getElementById('root')!);
// Public synthetic fixture, not a real account or user credential.
async function show(kind = 'credential', suffix = '') {
  const requestedAnimation = new URLSearchParams(location.search).get('animation');
  if (requestedAnimation) getLock('passcode')!.animation = requestedAnimation as any;
  const tree = kind === 'tap' ? { lockId: 'tap-to-unseal', config: { taps: 1 } }
    : { lockId: 'passcode', config: { boxLevel: true, minLength: 8 } };
  const ceremony = kind === 'corrupt' ? '@@@broken@@@' : serializeCeremony(tree);
  const payload = await compressContent('<h1>REVEAL VERIFIED' + suffix + '</h1>',
    kind === 'tap' || kind === 'plaintext' || kind === 'corrupt' ? {} : { password: '12345678', zk: true });
  const url = buildBittyUrl(payload.compressedUrl, { title: 'Seal test' + suffix, ceremony });
  const hashFragment = new URL(url).hash;
  const metadata = { title: 'Seal test', ...parseBittyHash(hashFragment).metadata };
  (window as any).fixtureUrl = url;
  root.render(<BittyRenderer hashFragment={hashFragment} metadata={metadata} />);
}
(window as any).showFixture = show;
await show(new URLSearchParams(location.search).get('kind') || 'credential');

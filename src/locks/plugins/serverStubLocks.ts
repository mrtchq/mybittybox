// src/locks/plugins/serverStubLocks.ts
//
// SERVER-DEPENDENT STUBS (Wave 1).
//
// Per product decision, the following 11 locks are wired into the registry so
// their Lock Lab tiles become clickable, but their evaluation is ALWAYS-PASS
// pending the backend they require (SMTP, Creem webhooks, chain RPC, Ed25519
// key provisioning, server KV, etc.). Each is flagged `requiresServer: true`
// and returns an honest reason so the UI can surface "backend-gated".
//
// This is an explicit, documented tradeoff — not silent. Real evaluators land
// in Wave 2 when their infrastructure exists.
import { LockPlugin, LockContext, LockEvaluation, pass } from '../types';

interface StubSpec {
  id: string;
  name: string;
  description: string;
  category: LockPlugin['category'];
  tags: LockPlugin['tags'];
  icon: string;
  animation: LockPlugin['animation'];
  needs: string;
}

const SPECS: StubSpec[] = [
  { id: 'totp', name: 'TOTP Lock', description: 'Validates a 6-digit rolling authenticator (RFC 6238). Server-gated (secret provisioning).', category: 'PROOF', tags: ['SERVER REQUIRED'], icon: 'Smartphone', animation: 'scan', needs: 'TOTP secret provisioning + verifier' },
  { id: 'signed-sender', name: 'Signed Sender Lock', description: 'Recipient validates Ed25519 creator signature. Server-gated (key distro).', category: 'IDENTITY', tags: ['SERVER REQUIRED'], icon: 'FileSignature', animation: 'dissolve', needs: 'Ed25519 key distribution' },
  { id: 'recipient-email', name: 'Recipient Email Lock', description: 'Signed one-time token to one email. Server-gated (SMTP + KV).', category: 'IDENTITY', tags: ['SERVER REQUIRED'], icon: 'Mail', animation: 'dissolve', needs: 'SMTP + one-time-token KV' },
  { id: 'wallet-signature', name: 'Wallet Signature Lock', description: 'Recipient signs a challenge proving Web3 custody. Server-gated (RPC).', category: 'IDENTITY', tags: ['SERVER REQUIRED'], icon: 'Wallet', animation: 'shatter', needs: 'chain RPC + challenge nonce' },
  { id: 'approval', name: 'Approval Lock', description: 'Creator manually approves unlock requests. Server-gated (review queue).', category: 'SOCIAL', tags: ['SERVER REQUIRED'], icon: 'BadgeCheck', animation: 'vault-door', needs: 'approval review backend' },
  { id: 'two-person', name: 'Two-Person Lock', description: 'Shamir Secret Sharing needs 2 keyholders. Server-gated (share custody).', category: 'SOCIAL', tags: ['SERVER REQUIRED'], icon: 'Users', animation: 'vault-door', needs: 'Shamir share custody backend' },
  { id: 'dead-man-switch', name: 'Dead-Man Switch Lock', description: 'Reveals if creator misses liveness check. Server-gated (scheduler).', category: 'SOCIAL', tags: ['SERVER REQUIRED'], icon: 'HeartPulse', animation: 'dissolve', needs: 'liveness scheduler backend' },
  { id: 'location', name: 'Location Lock', description: 'Verifies device geolocation within GPS radius. Server-gated (proof).', category: 'ENVIRONMENT', tags: ['SERVER REQUIRED'], icon: 'MapPin', animation: 'scan', needs: 'geo proof backend' },
  { id: 'device-pairing', name: 'Device Pairing Lock', description: 'Binds key to WebCrypto/Secure Enclave. Server-gated (pairing registry).', category: 'ENVIRONMENT', tags: ['SERVER REQUIRED'], icon: 'Laptop', animation: 'vault-door', needs: 'device pairing registry' },
  { id: 'chain-key', name: 'Chain Key Lock', description: 'Unlocks after validating a prior Box output. Server-gated (cross-box proof).', category: 'BEHAVIORAL', tags: ['SERVER REQUIRED'], icon: 'Link2', animation: 'dissolve', needs: 'cross-box proof backend' },
  { id: 'one-time-magic-key', name: 'One-Time Magic Key', description: 'Single-use asymmetric ephemeral key. Server-gated (key broker).', category: 'CREDENTIAL', tags: ['SERVER REQUIRED'], icon: 'Key', animation: 'vault-door', needs: 'one-time key broker' },
];

export const serverStubLocks: LockPlugin[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  category: s.category,
  tags: s.tags,
  urlResident: false,
  requiresServer: true,
  icon: s.icon,
  animation: s.animation,
  schema: [],
  validate: () => [],
  getHints: () => [`${s.name} is backend-gated (${s.needs}). Until that ships, it opens automatically.`],
  async evaluate(_config: Record<string, unknown>, _ctx: LockContext): Promise<LockEvaluation> {
    return pass({ note: `backend-gated: ${s.needs}` });
  },
}));

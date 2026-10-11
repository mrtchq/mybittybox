// src/locks/plugins/qrProximityLock.ts
// Lock #20 — QR Proximity Lock (client-verified, URL-resident).
import { LockPlugin, LockContext, LockEvaluation, fail, locked, pass } from '../types';

export interface QrProximityConfig {
  expected?: string;
}

export const qrProximityLock: LockPlugin<QrProximityConfig> = {
  id: 'qr-proximity',
  name: 'QR Proximity Lock',
  description: 'Requires scanning a companion physical QR / NFC tag. Client-verified.',
  category: 'ENVIRONMENT',
  tags: ['URL RESIDENT', 'OBJECT REQUIRED'],
  urlResident: true,
  requiresServer: false,
  icon: 'QrCode',
  animation: 'scan',
  schema: [
    { key: 'expected', label: 'Expected code', type: 'text', required: true, placeholder: 'value encoded in the QR/NFC' },
  ],
  validate(c) {
    if (!c.expected || !c.expected.trim()) return ['Embed the code the QR/NFC tag carries.'];
    return [];
  },
  getHints(c) {
    return ['Scan the physical QR code or tap the NFC tag shown by the creator.'];
  },
  evaluate(c, ctx): LockEvaluation {
    const attempt = typeof ctx.input === 'string' ? ctx.input.trim() : '';
    if (!attempt) return locked('Scan the QR / NFC tag to unlock.');
    return attempt === (c.expected ?? '').trim() ? pass() : fail('Scanned code does not match.');
  },
};

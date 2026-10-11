// src/locks/plugins/paymentLock.ts
// Lock #25 — Payment Lock (CLIENT-VERIFIED Creem return param; not fraud-proof).
//
// Honest scope: the visitor supplies the `?paid=1&session=<id>` return params
// that Creem redirects with after checkout. We verify the presence + that the
// session id matches the one embedded in the box config. This is spoofable by a
// determined user (they can forge the param), so `requiresServer: true` and the
// UI flags it as "client-verified — upgrade to webhook for guarantee". True
// enforcement needs the Creem webhook backend (phase 2).
import { LockPlugin, LockContext, LockEvaluation, fail, locked, pass } from '../types';

export interface PaymentConfig {
  checkoutUrl?: string;
  expectedSession?: string;
}

export const paymentLock: LockPlugin<PaymentConfig> = {
  id: 'payment',
  name: 'Payment Lock',
  description: 'Releases on confirmed payment (client-verified Creem return param).',
  category: 'PAYMENT',
  tags: ['COMMERCIAL TRUST', 'SERVER REQUIRED'],
  urlResident: true,
  requiresServer: true,
  icon: 'CreditCard',
  animation: 'shatter',
  schema: [
    { key: 'checkoutUrl', label: 'Creem checkout URL', type: 'text', placeholder: 'https://www.creem.io/checkout/...' },
    { key: 'expectedSession', label: 'Expected session id', type: 'text', placeholder: 'cs_test_... or order id' },
  ],
  validate() {
    return [];
  },
  getHints() {
    return ['After paying via the checkout link, you will be redirected with a payment confirmation.'];
  },
  evaluate(c, ctx): LockEvaluation {
    const supplied = typeof ctx.input === 'string' ? ctx.input : '';
    // supplied = a session/id string the visitor got from the Creem redirect
    if (!supplied) return locked('Complete the payment to receive your unlock token.');
    const want = (c.expectedSession ?? '').trim();
    if (want && supplied.trim() !== want) return fail('Payment token does not match this box.');
    return pass();
  },
};

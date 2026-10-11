import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '/tmp/bittybox-reveal-qa/node_modules/playwright/index.mjs';
const base = process.env.BITTY_QA_URL || 'http://127.0.0.1:4179';

test('incorrect credential keeps a visible gate and supports retry', async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/tests/reveal-harness.html');
    const input = page.locator('input').first();
    await input.fill('00000000');
    await page.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
    await page.getByText(/incorrect (passcode|password)|wrong password/i).waitFor();
    assert.equal(await page.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).isVisible(), true);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await page.locator('[data-ceremony-reveal]').count(), 0);
    await input.fill('12345678');
    await page.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
    await page.frameLocator('iframe').getByRole('heading', { name: 'REVEAL VERIFIED', exact: true }).waitFor();
  } finally { await browser.close(); }
});

test('verified credential plays vault-door before mounting content, then focuses content', async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/tests/reveal-harness.html');
    await page.locator('input').first().fill('12345678');
    await page.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
    const reveal = page.locator('[data-ceremony-reveal="vault-door"]');
    await reveal.waitFor({ timeout: 5000 });
    assert.equal(await page.locator('iframe').count(), 0, 'content must not execute during the reveal');
    assert.equal(await reveal.evaluate(el => el.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: '/root/backups/bittybox-reveal/vault-door-mobile.png' });
    await page.frameLocator('iframe').getByRole('heading', { name: 'REVEAL VERIFIED', exact: true }).waitFor();
    assert.equal(await page.locator('[data-ceremony-reveal]').count(), 0);
    assert.equal(await page.locator('iframe').evaluate(el => document.activeElement === el), true);
  } finally { await browser.close(); }
});

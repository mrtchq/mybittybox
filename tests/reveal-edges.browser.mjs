import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '/tmp/bittybox-reveal-qa/node_modules/playwright/index.mjs';
const base = process.env.BITTY_QA_URL || 'http://127.0.0.1:4179';
async function withPage(fn, options = {}) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try { await fn(await browser.newPage(options)); } finally { await browser.close(); }
}
async function unseal(page) {
  await page.locator('input').first().fill('12345678');
  await page.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
}
for (const animation of ['shatter', 'dissolve', 'burn', 'scan']) {
  test(`${animation} has a distinct animated seal and completes`, () => withPage(async page => {
    await page.goto(base + '/tests/reveal-harness.html?animation=' + animation);
    await unseal(page);
    const reveal = page.locator(`[data-ceremony-reveal="${animation}"]`);
    await reveal.waitFor({ timeout: 5000 });
    assert.equal(await reveal.locator('.ceremony-reveal__seal').evaluate(el => getComputedStyle(el).animationName), `ceremony-${animation}`);
    assert.equal(await page.locator('iframe').count(), 0);
    await page.frameLocator('iframe').getByText('REVEAL VERIFIED', { exact: true }).waitFor();
  }));
}
test('none animation opens without a transition', () => withPage(async page => {
  await page.goto(base + '/tests/reveal-harness.html?animation=none');
  await unseal(page);
  await page.frameLocator('iframe').getByText('REVEAL VERIFIED', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-ceremony-reveal]').count(), 0);
}));

test('tap-only ceremony reveals content after the visitor gesture', () => withPage(async page => {
  await page.goto(base + '/tests/reveal-harness.html?kind=tap');
  await page.getByRole('button', { name: 'TAP TO UNSEAL', exact: true }).click();
  await page.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
  await page.frameLocator('iframe').getByText('REVEAL VERIFIED', { exact: true }).waitFor();
}));

test('reduced motion skips reveal completely', () => withPage(async page => {
  await page.goto(base + '/tests/reveal-harness.html');
  await page.evaluate(() => {
    window.revealSeen = false;
    new MutationObserver(() => { if (document.querySelector('[data-ceremony-reveal]')) window.revealSeen = true; })
      .observe(document.body, { subtree: true, childList: true });
  });
  await unseal(page);
  await page.frameLocator('iframe').getByText('REVEAL VERIFIED', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.revealSeen), false);
}, { reducedMotion: 'reduce' }));

test('navigation to a different box never inherits the previous unlock', () => withPage(async page => {
  await page.goto(base + '/tests/reveal-harness.html');
  await unseal(page);
  await page.frameLocator('iframe').getByText('REVEAL VERIFIED', { exact: true }).waitFor();
  await page.evaluate(() => window.showFixture('credential', ' SECOND'));
  await page.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator('iframe').count(), 0);
  await unseal(page);
  await page.frameLocator('iframe').getByText('REVEAL VERIFIED SECOND', { exact: true }).waitFor();
}));

test('a corrupt ceremony shows a blocked state, not a blank screen', () => withPage(async page => {
  await page.goto(base + '/tests/reveal-harness.html?kind=corrupt');
  await page.getByRole('alert').waitFor({ timeout: 5000 });
  assert.equal(await page.locator('iframe').count(), 0);
  assert.match(await page.getByRole('alert').innerText(), /invalid|damaged|unsupported/i);
}));

test('a box-level credential must authenticate an encrypted payload', () => withPage(async page => {
  await page.goto(base + '/tests/reveal-harness.html?kind=plaintext');
  await unseal(page);
  await page.getByRole('alert').waitFor({ timeout: 5000 });
  assert.match(await page.getByRole('alert').innerText(), /encrypted payload/i);
  assert.equal(await page.locator('iframe').count(), 0);
}));

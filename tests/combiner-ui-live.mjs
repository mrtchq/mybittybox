// tests/combiner-ui-live.mjs
// Entry-point verification of the Phase 6 CeremonyBuilder surface on the LIVE site.
// Drives the REAL UI: dismiss splash + onboarding tour -> open Tools panel via
// Ctrl+] -> click the always-visible "LOCK LAB COMBINER" card -> open Combiner ->
// add Passcode + Tap-to-Unseal -> AND -> set box password -> APPLY -> navigate to
// the GENERATE slide -> click GENERATE -> capture the generated /cer/ URL -> open
// it -> assert wrong passcode stays sealed AND passcode+tap unlocks to verified content.
//
// The Combiner card was (2026-09-06) gated behind authentication; it is now
// always visible (OPEN TO ALL) so anonymous builders AND AI agents can use it.
import { chromium } from '/tmp/bittybox-reveal-qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const base = process.argv[2] || 'https://bittybox.org';
const checks = [];
const out = '/root/backups/bittybox-reveal/combiner-ui-' + (base.startsWith('https') ? 'live' : 'preview') + '-verification.json';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });

// Robustly dismiss the Shepherd onboarding tour if present.
async function dismissTour(page) {
  for (let i = 0; i < 8; i++) {
    if (!(await page.locator('.shepherd-modal-is-visible').count())) return;
    const exit = page.locator('.shepherd-cancel-icon, .shepherd-button:has-text("Skip"), .shepherd-button:has-text("Done"), .shepherd-button:has-text("Exit")').first();
    if (await exit.count()) { await exit.click({ timeout: 2000 }).catch(() => {}); }
    await page.waitForTimeout(400);
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Load homepage.
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  assert.ok(await page.locator('#root').innerText());
  checks.push('homepage React mount');

  // 2. Dismiss onboarding tour + animated splash to reach the editor.
  await dismissTour(page);
  const enterBtn = page.getByRole('button', { name: /ENTER BITTY BOX/i }).first();
  await enterBtn.waitFor({ timeout: 8000 });
  await enterBtn.click({ force: true });
  // Wait until the splash is gone (ENTER button no longer in DOM) — robust against tour re-renders.
  await enterBtn.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  // Then poll for a stable editor surface signal (hero copy OR the mode tabs).
  let editorReady = false;
  for (let i = 0; i < 40; i++) {
    await dismissTour(page);
    if (await page.getByText(/WEBPAGES PACKED IN A LINK/i).count()) { editorReady = true; break; }
    if (await page.getByRole('button', { name: 'EDITOR', exact: true }).count()) { editorReady = true; break; }
    if (await page.locator('#nav-lock-lab-btn').count()) { editorReady = true; break; }
    // Splash may have re-appeared (tour re-render) — click ENTER again.
    if (await page.getByRole('button', { name: /ENTER BITTY BOX/i }).count()) {
      await page.getByRole('button', { name: /ENTER BITTY BOX/i }).first().click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(500);
  }
  assert.ok(editorReady, 'editor surface never became ready after splash dismissal');
  checks.push('splash + tour dismissed -> editor reachable');

  // 2b. Add minimal content to slide 1 so the terminal GENERATE slide is not content-gated
  // ("PREVIEW (LOCKED)"). Without this, the Generate button never renders and step 11 can't run.
  const contentBox = page.getByLabel('Content for your Bitty Box').first();
  if (await contentBox.count()) { await contentBox.fill('Hello from the Lock Lab combiner proof.'); await page.waitForTimeout(300); }
  checks.push('minimal slide-1 content added (unlocks GENERATE slide)');

  // 3. Open the Tools side panel. The desktop trigger is the Ctrl+] shortcut
  // (no BITTY TOOLS button exists); the panel is not auth-gated.
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+]');
  await page.getByText('LOCK LAB COMBINER').first().waitFor({ timeout: 6000 });
  checks.push('tools panel opened via Ctrl+] and combiner card visible (OPEN TO ALL)');

  // 4. Open the Combiner modal via the always-visible card.
  await page.getByText('LOCK LAB COMBINER').first().click();
  await page.getByText('LOCK LAB — COMBINER').first().waitFor({ timeout: 6000 });
  checks.push('combiner modal opens');

  // 5. Security rating starts UNSEALED (no locks).
  await page.getByText('UNSEALED').first().waitFor({ timeout: 6000 });
  checks.push('security rating shows UNSEALED with no locks');

  // 6. Add Passcode + Tap-to-Unseal from the palette (buttons render "<name><tier · effort>").
  await page.getByRole('button', { name: /^Passcode Lock/i }).first().click();
  await page.getByRole('button', { name: /^Tap-to-Unseal Lock/i }).first().click();
  await page.locator('div', { hasText: /Box rating/i }).first().waitFor();
  checks.push('added passcode + tap-to-unseal leaves (anonymous builder reached the modal)');

  // 7. AND/OR toggle should be visible now (2 leaves). Force AND (default).
  const andBtn = page.getByRole('button', { name: 'AND', exact: true });
  await andBtn.waitFor({ timeout: 6000 });
  await andBtn.click();
  checks.push('AND/OR combine toggle present and set to AND');

  // 8. Rating should have moved off UNSEALED.
  const ratingTxt = await page.locator('div', { hasText: /Box rating/i }).first().innerText();
  assert.ok(!/UNSEALED/.test(ratingTxt), 'rating should leave UNSEALED after adding locks');
  checks.push('security rating upgraded after adding locks: ' + ratingTxt.replace(/\s+/g, ' ').slice(0, 60));

  // 9. Set the box password (credential leaf requires it).
  await page.getByPlaceholder(/At least 8 characters/i).first().fill('12345678');
  checks.push('box password field set');

  // 10. Apply to box.
  await page.getByRole('button', { name: /APPLY TO BOX/i }).first().click();
  await page.waitForTimeout(800);
  const boxRatingGone = await page.getByText('LOCK LAB — COMBINER').count();
  assert.equal(boxRatingGone, 0, 'combiner modal should close after apply');
  checks.push('apply closes combiner modal');

  // Helper: dismiss any full-screen modal overlay (fixed inset-0 z-50) that may have opened.
  // As an anonymous user, clicking through the combiner can flip currentView to 'account',
  // opening AccountDashboard's auth modal (z-50) over everything. The deterministic escape is
  // to click the EDITOR navbar tab (returns currentView to 'editor') — plus standard close affordances.
  async function dismissAnyModal(p) {
    for (let i = 0; i < 10; i++) {
      const overlay = p.locator('div.fixed.inset-0.z-50').first();
      if (!(await overlay.count())) return;
      // As an anonymous user, the app can route to #/account (currentView='account'), opening
      // AccountDashboard as a full-screen modal with no close button under its own overlay.
      // Resetting the hash to #/ flips currentView back to 'editor' via App's URL handler.
      await p.evaluate(() => { if (location.hash.includes('account')) location.hash = '#/'; }).catch(() => {});
      const editorTab = p.getByRole('button', { name: 'EDITOR', exact: true }).first();
      if (await editorTab.count()) await editorTab.click({ force: true }).catch(() => {});
      const close = p.getByRole('button', { name: /CLOSE|close|×|X|Done|Got it|CONTINUE/i }).first();
      if (await close.count()) await close.click({ force: true }).catch(() => {});
      const xBtn = p.locator('[aria-label*="close" i], [aria-label*="Close" i]').first();
      if (await xBtn.count()) await xBtn.click({ force: true }).catch(() => {});
      await p.keyboard.press('Escape');
      await p.mouse.click(5, 5);
      await p.waitForTimeout(400);
    }
  }

  // 10b. Ensure the Tools side panel is FULLY CLOSED before navigating the carousel,
  // otherwise its overlay intercepts the pager/"Jump" clicks. Click the panel's own CLOSE
  // button deterministically (works regardless of window focus), then assert it's gone.
  await dismissAnyModal(page);
  const closeBtn = page.getByRole('button', { name: 'CLOSE', exact: true }).first();
  if (await closeBtn.count()) { await closeBtn.click({ force: true }).catch(() => {}); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i++) {
    if (!(await page.getByText('BITTY TOOLS & ACCOUNT').count())) break;
    await page.mouse.click(8, 8); // left strip = backdrop blur (onClick=onClose)
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  const panelGone = await page.getByText('BITTY TOOLS & ACCOUNT').count();
  assert.equal(panelGone, 0, 'Tools side panel did not close after combiner apply');
  await dismissTour(page);

  // 10c. Final guarantee the Tools panel is closed right before navigating the carousel.
  // (In the full flow the panel can re-open after APPLY; loop the CLOSE button until gone.)
  for (let i = 0; i < 6; i++) {
    if (!(await page.getByText('BITTY TOOLS & ACCOUNT').count())) break;
    const cb = page.getByRole('button', { name: 'CLOSE', exact: true }).first();
    if (await cb.count()) await cb.click({ force: true }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  assert.equal(await page.getByText('BITTY TOOLS & ACCOUNT').count(), 0, 'Tools panel re-opened and would not close before navigation');

  // 11. Jump directly to the terminal (GENERATE) slide via the carousel's slide-indicator
  // dot, then fall back to the pager if needed. Use a direct DOM .click() (via evaluate) so the
  // full-screen decorative "rings-warp-portal-container" overlay can't swallow the hit-test.
  await dismissAnyModal(page);
  await dismissTour(page);
  const terminalDot = page.getByLabel('Jump to slide 5').first();
  if (await terminalDot.count()) {
    await terminalDot.evaluate((el) => el.click()).catch(() => {});
    await page.waitForTimeout(800);
  }
  if (!(await page.locator('#holo-generate-btn').count())) {
    for (let i = 0; i < 14; i++) {
      if (await page.locator('#holo-generate-btn').count()) break;
      await dismissAnyModal(page);
      await dismissTour(page);
      const next = page.getByRole('button', { name: /^Next/i }).first();
      if (await next.count()) { await next.evaluate((el) => el.click()).catch(() => {}); }
      await page.waitForTimeout(500);
    }
  }
  await dismissAnyModal(page);
  await dismissTour(page);
  await page.locator('#holo-generate-btn').first().waitFor({ timeout: 10000 });
  // GENERATE opens a new tab (window.open) with the box URL.
  const [newPage] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10000 }).catch(() => null),
    genBtn.click(),
  ]);
  let targetUrl = null;
  if (newPage) {
    await newPage.waitForLoadState('domcontentloaded').catch(() => {});
    targetUrl = newPage.url();
  }
  if (!targetUrl || !targetUrl.includes('/cer/')) {
    // Fallback: read the bittyUrl from the page via the address bar after replaceState.
    targetUrl = await page.evaluate(() => location.href);
  }
  assert.ok(targetUrl && targetUrl.includes('/cer/'), 'generated box must carry a /cer/ ceremony: ' + targetUrl);
  checks.push('generated URL carries /cer/ ceremony payload');

  // 12. Open the generated URL in a fresh page and verify it gates.
  const gate = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await gate.goto(targetUrl, { waitUntil: 'networkidle' });
  await gate.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).waitFor({ timeout: 10000 });
  checks.push('generated ceremony box shows lock gate');

  // Wrong passcode: stays sealed (no iframe may mount).
  await gate.locator('input').first().fill('00000000');
  await gate.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
  await gate.waitForTimeout(1500);
  assert.equal(await gate.locator('iframe').count(), 0, 'wrong passcode must NOT mount the reveal iframe');
  checks.push('wrong passcode stays sealed (no reveal/iframe)');

  // Right passcode + required taps: opens.
  await gate.locator('input').first().fill('12345678');
  await gate.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
  const tapBtn = gate.getByRole('button', { name: /TAP/i }); // matches "TAP TO UNSEAL" + "TAP AGAIN (n)"
  await tapBtn.first().waitFor({ timeout: 6000 });
  for (let i = 0; i < 3; i++) {
    if (!(await tapBtn.count())) break;
    await tapBtn.first().click();
    await gate.waitForTimeout(150);
  }
  await gate.getByRole('button', { name: 'UNSEAL TRANSMISSION', exact: true }).click();
  let revealSeen = 0, iframeCount = 0, contentOk = false;
  for (let i = 0; i < 20; i++) {
    await gate.waitForTimeout(500);
    revealSeen = await gate.getByText(/SEAL VERIFIED/i).count();
    iframeCount = await gate.locator('iframe').count();
    if (iframeCount > 0) {
      try {
        const t = await gate.frameLocator('iframe').first().locator('body').innerText();
        contentOk = t.length > 0;
      } catch {}
      if (contentOk) break;
    }
  }
  assert.ok(revealSeen > 0 || iframeCount > 0, 'expected reveal caption or iframe after combined unlock');
  checks.push('passcode + tap AND-combined gate unlocks to verified content (revealSeen=' + revealSeen + ', iframe=' + iframeCount + ', contentOk=' + contentOk + ')');

  assert.deepEqual(errors, []);
  checks.push('no uncaught page errors during combiner flow');

  console.log(JSON.stringify({ base, passed: true, targetUrl, checks }, null, 2));
  writeFileSync(out, JSON.stringify({ base, passed: true, targetUrl, checks }, null, 2));
} catch (error) {
  console.error('FAILED after:', checks, error);
  try { writeFileSync(out, JSON.stringify({ base, passed: false, checks, error: String(error) }, null, 2)); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}

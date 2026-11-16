/**
 * Headless smoke test for FieldNotes (demo mode — no Firebase project).
 *
 * Usage:
 *   npm run preview &            # serves dist/ on http://localhost:4173
 *   node scripts/smoke-test.mjs
 *
 * Exits non-zero if the app fails to render, any console error / page error
 * occurs, or any of the main flows (sample notes, summarise, deep analysis,
 * create note, search) does not complete.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173';
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;

const failures = [];
const consoleErrors = [];
const failedRequests = [];

function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on('requestfailed', (req) =>
  failedRequests.push(`${req.url()} — ${req.failure()?.errorText ?? 'failed'}`),
);

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1. App renders
const h1 = await page.locator('h1').innerText();
check('app renders with FieldNotes title', h1.includes('FieldNotes'), h1);
check(
  'demo-mode banner visible',
  await page.locator('.demo-banner').isVisible(),
);
check(
  'status bar shows demo mode pill',
  (await page.locator('.statusbar').innerText()).includes('Demo mode'),
);

// 2. Load sample notes
await page.getByRole('button', { name: 'Load sample notes' }).first().click();
await page.waitForSelector('.note-card', { timeout: 5000 });
const cardCount = await page.locator('.note-card').count();
check('3 sample notes loaded', cardCount === 3, `${cardCount} cards`);

// 3. Summarise first note (demo-mode mock)
await page.locator('.note-card').first().getByRole('button', { name: /Summarise/ }).click();
await page.waitForSelector('.badge-demo', { timeout: 5000 });
const badge = await page.locator('.badge-demo').first().innerText();
check('summary shows Demo mock badge', badge.includes('Demo mock'), badge);
const summaryText = await page.locator('.summary-text').first().innerText();
check('summary text present', summaryText.length > 20, summaryText.slice(0, 60));
const stats = await page.locator('.stats').innerText();
check('stats show 1 summarised / 1 mock', stats.includes('1') && stats.includes('🧪 1'), stats);

// 4. Deep analysis (demo-mode mock)
await page.getByRole('button', { name: /Run deep analysis/ }).click();
await page.waitForSelector('.report-result', { timeout: 5000 });
const themes = await page.locator('.report-cols li').count();
check('deep analysis renders themes/actions/connections', themes >= 3, `${themes} items`);
check(
  'report also labelled Demo mock',
  (await page.locator('.report-result .badge-demo').count()) === 1,
);

// 5. Create a new note
await page.getByRole('button', { name: '+ New note' }).click();
await page.locator('.editor input').first().fill('Smoke test note');
await page.locator('.editor textarea').fill('The quick brown fox jumps over the lazy dog near the river bank.');
await page.getByRole('button', { name: 'Save note' }).click();
await page.waitForTimeout(500);
check(
  'new note appears in list',
  (await page.locator('.note-card h3', { hasText: 'Smoke test note' }).count()) === 1,
);

// 6. Search filters the list
await page.locator('.search').fill('mangrove');
await page.waitForTimeout(300);
const filtered = await page.locator('.note-card').count();
check('search "mangrove" filters to 1 note', filtered === 1, `${filtered} cards`);
await page.locator('.search').fill('');

// 7. Export buttons produce downloads
const download = page.waitForEvent('download', { timeout: 5000 });
await page.getByRole('button', { name: 'Export .md' }).click();
const dl = await download;
check('Markdown export downloads', dl.suggestedFilename() === 'fieldnotes.md', dl.suggestedFilename());

// 8. No console errors / failed requests
check('no console errors or page errors', consoleErrors.length === 0, consoleErrors.join(' | '));
check('no failed requests', failedRequests.length === 0, failedRequests.join(' | '));

await page.screenshot({ path: '/tmp/fieldnotes-smoke.png', fullPage: true });
await browser.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');

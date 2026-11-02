#!/usr/bin/env node
/**
 * Captures phone-sized screenshots of every ScanPilot screen.
 *
 *   npm run screenshots
 *
 * 1. Exports a web build with SCANPILOT_DEMO=1 (in-memory sample data; see metro.config.js).
 * 2. Generates synthetic sample page images.
 * 3. Serves the build locally and drives it with Playwright (Chromium).
 * Output: docs/screenshots/*.png and docs/screenshots/overview.png.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, '.demo-web');
const outDir = path.join(root, 'docs', 'screenshots');
const skipBuild = process.argv.includes('--skip-build');

if (!skipBuild) {
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dist, '--clear'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SCANPILOT_DEMO: '1', EXPO_OFFLINE: '1', CI: '1' },
  });
  execFileSync('python3', ['-I', path.join(root, 'scripts/screenshots/make_demo_assets.py'), path.join(dist, 'demo-assets')], { stdio: 'inherit' });
}
mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(dist, url);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = require('playwright');
const browser = await chromium.launch();

/** [file name, path+query, optional interaction before the shot] */
const shots = [
  ['01-onboarding', '/?onboarding=1'],
  ['02-home', '/'],
  ['03-home-dark', '/?theme=dark'],
  ['04-files-grid', '/library'],
  ['05-files-list', '/library?view=list'],
  ['06-files-search', '/library', async (p) => p.getByPlaceholder('Search documents').first().fill('receipt')],
  ['07-files-favourites', '/library', async (p) => p.getByRole('button', { name: 'Favourites' }).click()],
  ['08-sort-sheet', '/library', async (p) => p.getByLabel(/^Sort:/).click()],
  ['09-add-sheet', '/library', async (p) => p.getByLabel('Add documents').click()],
  ['10-document-actions', '/library', async (p) => p.getByLabel('More actions for Rental agreement 2026').first().click()],
  ['11-move-to-folder', '/library', async (p) => {
    await p.getByLabel('More actions for Grocery receipt').first().click();
    await p.waitForTimeout(400);
    await p.getByRole('menuitem', { name: 'Move to folder' }).click();
  }],
  ['12-rename-dialog', '/library', async (p) => {
    await p.getByLabel('More actions for Invoice INV-2048').first().click();
    await p.waitForTimeout(400);
    await p.getByRole('menuitem', { name: 'Rename' }).click();
  }],
  ['13-pdf-viewer', '/document/doc-lease'],
  ['14-folder', '/folder/f-contracts'],
  ['15-folders', '/folders'],
  ['16-tools', '/tools'],
  ['17-settings', '/settings'],
  ['18-settings-dark', '/settings?theme=dark'],
  ['19-privacy', '/privacy'],
  ['20-licences', '/licenses'],
  ['21-scan-review', '/scan/review'],
  ['22-scan-review-photo', '/scan/review?page=p3'],
  ['23-scan-presets', '/scan/review', async (p) => p.getByRole('button', { name: /^Receipt,/ }).click()],
  ['24-scan-add-pages', '/scan/review', async (p) => p.getByLabel('Add pages').last().click()],
  ['25-crop-editor', '/scan/crop?id=p3', dragCornersOntoPaper],
  ['26-crop-editor-dark', '/scan/crop?id=p3&theme=dark', dragCornersOntoPaper],
];

/** Drags the four handles onto the paper corners in the sample photo (900×1200 image). */
async function dragCornersOntoPaper(page) {
  const paper = [[170, 170], [760, 120], [820, 1060], [110, 1110]];
  const names = ['top left', 'top right', 'bottom right', 'bottom left'];
  const imageBox = await page.locator('img[src*="photo-3"]').first().boundingBox();
  for (let i = 0; i < 4; i += 1) {
    const handle = page.getByLabel(`${names[i]} corner`);
    const box = await handle.boundingBox();
    const scale = imageBox.width / 900;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(imageBox.x + paper[i][0] * scale, imageBox.y + paper[i][1] * scale, { steps: 8 });
    await page.mouse.up();
  }
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
const failures = [];
for (const [name, route, act] of shots) {
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(`${name}: ${e.message}`));
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (act) {
    await act(page);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await page.close();
  console.log(`✓ ${name}`);
}
await browser.close();
server.close();

execFileSync('python3', ['-I', path.join(root, 'scripts/screenshots/contact_sheet.py'), outDir], { stdio: 'inherit' });
if (failures.length) {
  console.error(`\nPage errors:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}

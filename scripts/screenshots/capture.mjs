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
    env: { ...process.env, SCANPILOT_DEMO: '1', EXPO_PUBLIC_SCANPILOT_DEMO: '1', EXPO_OFFLINE: '1', CI: '1' },
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
  ['23-scan-presets', '/scan/review', async (p) => {
    await p.getByLabel('Page size', { exact: true }).click();
    await p.getByRole('button', { name: /^Receipt,/ }).click();
  }],
  ['24-scan-add-pages', '/scan/review', async (p) => p.getByLabel('Add pages').last().click()],
  ['27-merge', '/tool/merge?ids=doc-lease,doc-bill,doc-invoice'],
  ['28-merge-select', '/tool/merge?ids=doc-lease', async (p) => p.getByLabel('Add', { exact: true }).click()],
  ['29-split', '/tool/split?id=doc-tax', async (p) => p.getByLabel('Page ranges').fill('1-6, 7-12, 13-')],
  ['30-split-extract', '/tool/split?id=doc-lease', async (p) => {
    await p.getByRole('radio', { name: /^Extract pages/ }).click();
    await p.getByLabel('Pages to extract').fill('1, 4-6');
  }],
  ['31-compress', '/tool/compress?id=doc-tax'],
  ['32-organize', '/tool/organize?id=doc-lease', async (p) => {
    await p.getByLabel('Page 2', { exact: true }).click();
    await p.getByLabel('Page 5', { exact: true }).click();
    await p.getByLabel('Right', { exact: true }).click();
  }],
  ['33-organize-save', '/tool/organize?id=doc-lease', async (p) => {
    await p.getByLabel('Page 1', { exact: true }).click();
    await p.getByLabel('Delete', { exact: true }).click();
    await p.waitForTimeout(300);
    await p.getByLabel('Page 3', { exact: true }).click();
    await p.getByLabel('Left', { exact: true }).click();
    await p.getByLabel('Save changes').click();
  }],
  ['34-document-menu', '/document/doc-lease', async (p) => p.getByLabel('More actions').click()],
  ['35-sign-empty', '/tool/sign'],
  ['36-sign-pad', '/tool/sign?id=doc-lease', async (p) => {
    await p.getByLabel('Signature', { exact: true }).click();
    await p.waitForTimeout(500);
    await drawSignature(p);
  }],
  ['37-sign-placed', '/tool/sign?id=doc-lease', async (p) => {
    await p.getByLabel('Signature', { exact: true }).click();
    await p.waitForTimeout(500);
    await drawSignature(p);
    await p.getByLabel('Use signature').click();
    await p.waitForTimeout(500);
    await p.getByLabel('Date', { exact: true }).click();
  }],
  ['38-edit', '/tool/edit?id=doc-invoice', async (p) => {
    const area = await p.getByLabel('Page 1 editing area').boundingBox();
    const stroke = async (pts) => {
      await p.mouse.move(area.x + pts[0][0] * area.width, area.y + pts[0][1] * area.height);
      await p.mouse.down();
      for (const [x, y] of pts.slice(1)) await p.mouse.move(area.x + x * area.width, area.y + y * area.height, { steps: 6 });
      await p.mouse.up();
    };
    await stroke([[0.55, 0.12], [0.6, 0.08], [0.7, 0.14], [0.8, 0.09], [0.9, 0.13]]);
    await p.getByLabel('Highlight', { exact: true }).click();
    await stroke([[0.08, 0.235], [0.4, 0.235]]);
    await p.getByLabel('Box', { exact: true }).click();
    await stroke([[0.57, 0.6], [0.95, 0.72]]);
    await p.getByLabel('Arrow', { exact: true }).click();
    await stroke([[0.35, 0.82], [0.55, 0.7]]);
  }],
  ['39-redact', '/tool/redact?id=doc-id', async (p) => {
    const area = await p.getByLabel('Page 1 editing area').boundingBox();
    const box = async (x0, y0, x1, y1) => {
      await p.mouse.move(area.x + x0 * area.width, area.y + y0 * area.height);
      await p.mouse.down();
      await p.mouse.move(area.x + x1 * area.width, area.y + y1 * area.height, { steps: 6 });
      await p.mouse.up();
    };
    await box(0.43, 0.2, 0.8, 0.31);
    await box(0.2, 0.38, 0.8, 0.43);
  }],
  ['40-watermark', '/tool/watermark?id=doc-lease'],
  ['41-page-numbers', '/tool/page-numbers?id=doc-tax'],
  ['42-protect', '/tool/protect?id=doc-tax', async (p) => {
    await p.getByLabel('Password', { exact: true }).fill('secret12');
    await p.getByLabel('Repeat password').fill('secret12');
  }],
  ['43-ocr', '/tool/ocr?id=doc-lease', async (p) => {
    await p.getByLabel('Extract text', { exact: true }).click();
    await p.waitForTimeout(600);
    await p.getByPlaceholder('Search in the text').fill('rent');
  }],
  ['44-pdf-to-images', '/tool/pdf-to-images?id=doc-lease', async (p) => p.getByLabel('Convert to JPG').click()],
  ['45-text-to-pdf', '/tool/text-to-pdf', async (p) => {
    await p.getByLabel('Title', { exact: true }).fill('Leave application');
    await p.getByLabel('Text', { exact: true }).fill('Dear Sir/Madam,\n\nI request leave from 10 to 14 November for a family function.\n\nThank you,\nAsha');
  }],
  ['46-crop-pdf', '/tool/crop?id=doc-bill'],
  ['47-unlock', '/tool/unlock?id=doc-tax'],
  ['48-scan-filters', '/scan/review', async (p) => p.getByLabel('Filter', { exact: true }).click()],
  ['49-document-tools', '/document/doc-lease', async (p) => {
    await p.getByLabel('More actions').click();
    await p.waitForTimeout(400);
    await p.getByRole('menuitem', { name: 'PDF tools…' }).click();
  }],
  ['50-intro-from-settings', '/settings', async (p) => {
    await p.getByLabel('Show introduction again').click();
    await p.waitForTimeout(700);
  }],
  ['51-intro-step-2', '/?onboarding=1', async (p) => p.getByLabel('Continue').click()],
  ['52-intro-small-phone', '/?onboarding=1', async (p) => p.setViewportSize({ width: 360, height: 640 })],
  ['53-files-empty-folder', '/folder/f-empty'],
  ['54-tool-picker-sources', '/tool/sign', async (p) => p.getByLabel('Choose from library').click()],
  ['55-camera', '/scan/camera'],
  ['56-camera-batch', '/scan/camera', async (p) => {
    await p.getByLabel('Show grid').click();
    await p.getByLabel('Take photo').click();
    await p.waitForTimeout(500);
    await p.getByLabel('Take photo').click();
    await p.waitForTimeout(700);
  }],
  ['25-crop-editor', '/scan/crop?id=p3', dragCornersOntoPaper],
  ['26-crop-editor-dark', '/scan/crop?id=p3&theme=dark', dragCornersOntoPaper],
];

async function drawSignature(page) {
  const pad = await page.getByLabel('Signature drawing area').boundingBox();
  const pts = [[0.15, 0.6], [0.2, 0.35], [0.25, 0.65], [0.3, 0.4], [0.36, 0.62], [0.42, 0.45], [0.5, 0.58], [0.58, 0.42], [0.66, 0.6], [0.75, 0.5], [0.85, 0.55]];
  await page.mouse.move(pad.x + pts[0][0] * pad.width, pad.y + pts[0][1] * pad.height);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(pad.x + x * pad.width, pad.y + y * pad.height, { steps: 5 });
  await page.mouse.up();
  await page.mouse.move(pad.x + 0.3 * pad.width, pad.y + 0.72 * pad.height);
  await page.mouse.down();
  await page.mouse.move(pad.x + 0.8 * pad.width, pad.y + 0.7 * pad.height, { steps: 6 });
  await page.mouse.up();
}

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

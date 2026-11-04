#!/usr/bin/env node
/**
 * Renders the ScanPilot launcher icon, Android adaptive-icon layers, splash
 * image and favicon from the same vector mark as src/components/brand/Logo.tsx.
 *
 *   node scripts/brand/render-icons.mjs
 *
 * Uses the pre-installed Playwright Chromium; writes into assets/images/.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = (name) => path.join(root, 'assets/images', name);

const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs>`;

/** Keep in sync with LogoGlyph in src/components/brand/Logo.tsx (100×100 units). */
function glyph({ mono = false } = {}) {
  const white = '#FFFFFF';
  const c = (color) => (mono ? white : color);
  const corner = (d) => `<path d="${d}" stroke="${white}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  return [
    corner('M22 36 V28 a6 6 0 0 1 6 -6 h8'),
    corner('M64 22 h8 a6 6 0 0 1 6 6 v8'),
    corner('M78 64 v8 a6 6 0 0 1 -6 6 h-8'),
    corner('M36 78 h-8 a6 6 0 0 1 -6 -6 v-8'),
    `<path d="M38 31 h17 l9 9 v26 a3 3 0 0 1 -3 3 h-23 a3 3 0 0 1 -3 -3 v-32 a3 3 0 0 1 3 -3 z" fill="${white}"/>`,
    mono ? '' : `<path d="M55 31 v9 h9 z" fill="#C7C4FF"/>`,
    mono ? '' : `<rect x="41" y="44" width="15" height="3" rx="1.5" fill="#A5A1F5"/>`,
    mono ? '' : `<rect x="41" y="57" width="19" height="3" rx="1.5" fill="#D4D2FA"/>`,
    mono ? '' : `<rect x="41" y="63" width="11" height="3" rx="1.5" fill="#D4D2FA"/>`,
    `<rect x="28" y="49.5" width="44" height="3.5" rx="1.75" fill="${c('#5EEAD4')}"/>`,
  ].join('');
}

const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${gradient}${body}</svg>`;

const targets = [
  // iOS / store icon: full-bleed square (the OS applies its own mask).
  { file: 'icon.png', size: 1024, opaque: true, svg: svg('0 0 100 100', `<rect width="100" height="100" fill="url(#g)"/><g transform="translate(-6 -6) scale(1.12)">${glyph()}</g>`) },
  // Android adaptive icon: gradient layer + glyph inside the 66% safe zone.
  { file: 'android-icon-background.png', size: 512, svg: svg('0 0 100 100', `<rect width="100" height="100" fill="url(#g)"/>`) },
  { file: 'android-icon-foreground.png', size: 512, svg: svg('-14 -14 128 128', glyph()) },
  { file: 'android-icon-monochrome.png', size: 432, svg: svg('-14 -14 128 128', glyph({ mono: true })) },
  // Splash + favicon: the rounded mark.
  { file: 'splash-icon.png', size: 512, svg: svg('0 0 100 100', `<rect width="100" height="100" rx="30" fill="url(#g)"/>${glyph()}`) },
  { file: 'favicon.png', size: 48, svg: svg('0 0 100 100', `<rect width="100" height="100" rx="26" fill="url(#g)"/>${glyph()}`) },
];

const { chromium } = require('playwright');
const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><div style="width:${t.size}px;height:${t.size}px">${t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</div></body></html>`,
  );
  const png = await page.screenshot({ omitBackground: !t.opaque, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(out(t.file), png);
  await page.close();
  console.log(`✓ ${t.file} (${t.size}px)`);
}
await browser.close();

#!/usr/bin/env node
/**
 * Renders the ScanPilot launcher icon, Android adaptive-icon layers, splash
 * image and favicon from the same vector mark as src/components/brand/Logo.tsx.
 *
 *   node scripts/brand/render-icons.mjs
 *
 * Uses the pre-installed Playwright Chromium; writes into assets/images/.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = (name) => path.join(root, 'assets/images', name);

// Single source of truth: the SVG strings in src/components/brand/logoSvg.ts.
const source = readFileSync(path.join(root, 'src/components/brand/logoSvg.ts'), 'utf8');
const part = (name) => {
  const m = source.match(new RegExp(`export const ${name} = \\\`([\\s\\S]*?)\\\`;`));
  if (!m) throw new Error(`${name} not found in logoSvg.ts`);
  return m[1];
};
const BG = part('LOGO_BACKGROUND');
const GLYPH = part('LOGO_GLYPH');
const MONO = part('LOGO_GLYPH_MONO');

const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
const rounded = (rx) => `<defs><clipPath id="clip"><rect width="100" height="100" rx="${rx}"/></clipPath></defs><g clip-path="url(#clip)">${BG}</g>`;

const targets = [
  // iOS / store icon: full-bleed square (the OS applies its own mask); glyph slightly larger.
  { file: 'icon.png', size: 1024, opaque: true, svg: svg('0 0 100 100', `${BG}<g transform="translate(-5 -5) scale(1.1)">${GLYPH}</g>`) },
  // Android adaptive icon: background layer + glyph inside the 66% safe zone.
  { file: 'android-icon-background.png', size: 512, svg: svg('0 0 100 100', BG) },
  { file: 'android-icon-foreground.png', size: 512, svg: svg('-12 -12 124 124', GLYPH) },
  { file: 'android-icon-monochrome.png', size: 432, svg: svg('-12 -12 124 124', MONO) },
  // Splash + favicon: the rounded mark.
  { file: 'splash-icon.png', size: 512, svg: svg('0 0 100 100', `${rounded(30)}${GLYPH}`) },
  { file: 'favicon.png', size: 48, svg: svg('0 0 100 100', `${rounded(26)}${GLYPH}`) },
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

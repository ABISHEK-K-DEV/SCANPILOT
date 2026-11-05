/**
 * ScanPilot brand mark — single source for the in-app logo (SvgXml) and the
 * launcher icon / splash / favicon (scripts/brand/render-icons.mjs reads the
 * strings below, so keep them plain template literals without ${…}).
 *
 * Design: an "aurora" squircle (indigo → violet with cyan and pink glows and a
 * glossy top light), two stacked pages with depth, a glowing scan beam and
 * scan-frame corners.
 */

/** Background tile, 100 × 100. Uses rx for the in-app squircle; the launcher icon is full-bleed. */
export const LOGO_BACKGROUND = `
<defs>
  <linearGradient id="sp-bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4338CA"/>
    <stop offset="0.55" stop-color="#6D28D9"/>
    <stop offset="1" stop-color="#9333EA"/>
  </linearGradient>
  <radialGradient id="sp-glow-cyan" cx="0.18" cy="0.12" r="0.62">
    <stop offset="0" stop-color="#22D3EE" stop-opacity="0.75"/>
    <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="sp-glow-pink" cx="0.92" cy="0.95" r="0.6">
    <stop offset="0" stop-color="#F472B6" stop-opacity="0.8"/>
    <stop offset="1" stop-color="#F472B6" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="sp-gloss" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/>
    <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="100" height="100" fill="url(#sp-bg)"/>
<rect width="100" height="100" fill="url(#sp-glow-cyan)"/>
<rect width="100" height="100" fill="url(#sp-glow-pink)"/>
<rect width="100" height="100" fill="url(#sp-gloss)"/>`;

/** Foreground glyph, 100 × 100, centred in the 22…78 safe area. */
export const LOGO_GLYPH = `
<defs>
  <linearGradient id="sp-beam" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#5EEAD4" stop-opacity="0"/>
    <stop offset="0.2" stop-color="#5EEAD4"/>
    <stop offset="0.8" stop-color="#22D3EE"/>
    <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="sp-page" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="1" stop-color="#E9E7FF"/>
  </linearGradient>
</defs>
<g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
  <path d="M20 34 V27 a7 7 0 0 1 7 -7 h7"/>
  <path d="M66 20 h7 a7 7 0 0 1 7 7 v7"/>
  <path d="M80 66 v7 a7 7 0 0 1 -7 7 h-7"/>
  <path d="M34 80 h-7 a7 7 0 0 1 -7 -7 v-7"/>
</g>
<rect x="38" y="28" width="28" height="38" rx="4" fill="#FFFFFF" opacity="0.35" transform="rotate(9 52 47)"/>
<rect x="35.5" y="42" width="28" height="32" rx="4" fill="#1E1B4B" opacity="0.22"/>
<path d="M36 31 h17 l9 9 v28 a3.5 3.5 0 0 1 -3.5 3.5 h-22.5 a3.5 3.5 0 0 1 -3.5 -3.5 v-33.5 a3.5 3.5 0 0 1 3.5 -3.5 z" fill="url(#sp-page)"/>
<path d="M53 31 v6 a3 3 0 0 0 3 3 h6 z" fill="#C4B5FD"/>
<rect x="38.5" y="44" width="15" height="3.2" rx="1.6" fill="#8B5CF6"/>
<rect x="38.5" y="58" width="18" height="3.2" rx="1.6" fill="#C4B5FD"/>
<rect x="38.5" y="64" width="11" height="3.2" rx="1.6" fill="#C4B5FD"/>
<rect x="22" y="48.5" width="56" height="7" rx="3.5" fill="#22D3EE" opacity="0.28"/>
<rect x="24" y="50.5" width="52" height="3.2" rx="1.6" fill="url(#sp-beam)"/>`;

/** Monochrome glyph for Android 13 themed icons. */
export const LOGO_GLYPH_MONO = `
<g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 34 V27 a7 7 0 0 1 7 -7 h7"/>
  <path d="M66 20 h7 a7 7 0 0 1 7 7 v7"/>
  <path d="M80 66 v7 a7 7 0 0 1 -7 7 h-7"/>
  <path d="M34 80 h-7 a7 7 0 0 1 -7 -7 v-7"/>
</g>
<path d="M36 31 h17 l9 9 v28 a3.5 3.5 0 0 1 -3.5 3.5 h-22.5 a3.5 3.5 0 0 1 -3.5 -3.5 v-33.5 a3.5 3.5 0 0 1 3.5 -3.5 z" fill="#FFFFFF"/>
<rect x="24" y="50.5" width="52" height="3.2" rx="1.6" fill="#FFFFFF"/>`;

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { AppText } from '@/components/ui';

import { LOGO_BACKGROUND, LOGO_GLYPH } from './logoSvg';

/** The glyph without its scan beam, for places that animate the beam themselves. */
const GLYPH_NO_BEAM = LOGO_GLYPH.split('\n')
  .filter((line) => !line.includes('<rect x="22" y="48.5"') && !line.includes('url(#sp-beam)'))
  .join('\n');

const MARK_XML = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${LOGO_BACKGROUND}${LOGO_GLYPH}</svg>`;
const MARK_XML_NO_BEAM = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${LOGO_BACKGROUND}${GLYPH_NO_BEAM}</svg>`;

/** App mark (same artwork as the launcher icon). Children are drawn on top, e.g. an animated beam. */
export function LogoMark({ size = 40, children }: { size?: number; children?: ReactNode }) {
  return (
    <View
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SvgXml xml={children ? MARK_XML_NO_BEAM : MARK_XML} width={size} height={size} />
      {children}
    </View>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="ScanPilot">
      <LogoMark size={size} />
      <AppText variant="title" style={styles.word}>
        ScanPilot
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontSize: 20, letterSpacing: -0.5 },
});

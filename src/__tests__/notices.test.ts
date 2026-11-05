/// <reference types="node" />
import { execFileSync } from 'child_process';
import path from 'path';

import { LICENSE_TEXTS, NATIVE_COMPONENTS, THIRD_PARTY_PACKAGES } from '@/legal/thirdPartyNotices.generated';

describe('third-party notices', () => {
  it('is up to date with node_modules', () => {
    expect(() => execFileSync('node', [path.join(__dirname, '../../scripts/generate-notices.js'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('covers the main libraries with their licence text', () => {
    for (const name of ['react-native', 'expo', '@cantoo/pdf-lib', 'lucide-react-native', 'expo-camera']) {
      const entry = THIRD_PARTY_PACKAGES.find((p) => p[0] === name);
      expect(entry).toBeDefined();
      expect(entry![3]).toBeGreaterThanOrEqual(0);
      expect(LICENSE_TEXTS[entry![3]].length).toBeGreaterThan(100);
    }
    expect(NATIVE_COMPONENTS.map((c) => c.name).join(' ')).toMatch(/CameraX/);
  });
});

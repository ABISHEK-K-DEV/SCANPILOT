import { useScanSession } from '@/stores/scanSessionStore';
import { type AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

/**
 * Demo settings come from the URL, e.g. `?theme=dark&view=list&onboarding=1`,
 * so every screen can be captured in each state.
 */
export async function loadSettings(): Promise<AppSettings> {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/scan')) {
    const session = useScanSession.getState();
    session.start();
    session.setName('Scan 2026-11-02 15.18');
    session.add(
      [1, 2, 3].map((n) => ({
        id: `p${n}`,
        // Page 3 is an uncropped photo from the gallery, for the crop editor.
        uri: n === 3 ? '/demo-assets/scan/photo-3.jpg' : `/demo-assets/scan/page-${n}.jpg`,
        originalUri: n === 3 ? '/demo-assets/scan/photo-3.jpg' : `/demo-assets/scan/page-${n}.jpg`,
        width: n === 3 ? 900 : 1240,
        height: n === 3 ? 1200 : 1754,
        originalWidth: n === 3 ? 900 : 1240,
        originalHeight: n === 3 ? 1200 : 1754,
      })),
    );
    session.select(params.get('page') ?? 'p1');
    if (params.get('scanmode') === 'business-card') {
      session.start();
      session.setMode('business-card', 'business-card', 'Business card');
      session.add([{ id: 'c1', uri: '/demo-assets/doc-card/page-1.png', originalUri: '/demo-assets/doc-card/page-1.png', width: 1240, height: 800, originalWidth: 1240, originalHeight: 800 }]);
    }
    if (params.get('scanmode') === 'id-card') {
      session.setMode('id-card', 'a4', 'ID card');
      session.remove('p3');
    }
  }
  return {
    ...DEFAULT_SETTINGS,
    onboardingComplete: params.get('onboarding') !== '1',
    theme: (params.get('theme') as AppSettings['theme']) ?? 'light',
    viewMode: params.get('view') === 'list' ? 'list' : 'grid',
  };
}

export async function saveSetting(): Promise<void> {
  // In-memory only in the demo build.
}

const values = new Map<string, unknown>();
export async function loadValue<T>(key: string): Promise<T | null> {
  return (values.get(key) as T) ?? null;
}
export async function saveValue(key: string, value: unknown): Promise<void> {
  values.set(key, value);
}

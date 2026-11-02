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

import { Platform } from 'react-native';

import { ScanPilotNative } from '../../../modules/scanpilot-native';

/**
 * Modular OCR: each provider declares the languages it supports. Today:
 * Google ML Kit on-device models (Latin + Devanagari) on Android. Adding a
 * language pack or another engine (e.g. Tesseract) means adding a provider.
 */
export type OcrLanguage = 'en' | 'hi';

export const OCR_LANGUAGES: readonly { id: OcrLanguage; label: string; hint: string }[] = [
  { id: 'en', label: 'English', hint: 'Latin script — also French, German, Spanish…' },
  { id: 'hi', label: 'Hindi + English', hint: 'Devanagari and Latin text' },
];

export interface RecognisedLine {
  text: string;
  /** Fractions of the image: left, top, width, height. */
  box: { x: number; y: number; width: number; height: number };
}

export interface RecognisedPage {
  text: string;
  lines: RecognisedLine[];
}

export interface OcrProvider {
  id: string;
  recognise(imageUri: string, language: OcrLanguage): Promise<RecognisedPage>;
}

const mlKit: OcrProvider | null =
  Platform.OS === 'android' && ScanPilotNative
    ? {
        id: 'mlkit',
        async recognise(uri, language) {
          const native = ScanPilotNative;
          if (!native) throw new Error('OCR is not available.');
          const r = await native.recognizeText(uri, language === 'hi' ? 'devanagari' : 'latin');
          const w = Math.max(1, r.width);
          const h = Math.max(1, r.height);
          return {
            text: r.text,
            lines: r.lines.map((l) => ({ text: l.text, box: { x: l.left / w, y: l.top / h, width: l.width / w, height: l.height / h } })),
          };
        },
      }
    : null;

export function getOcrProvider(): OcrProvider | null {
  return mlKit;
}

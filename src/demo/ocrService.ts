/** Demo stand-in for on-device OCR: returns sample recognised text. */
import type { ScanDocument } from '@/types/document';

const SAMPLE = [
  'RENTAL AGREEMENT\nThis agreement is made on 2 November 2026 between the Landlord and the Tenant.\n1. Term. The tenancy starts on 1 December 2026 for a period of eleven months.\n2. Rent. The monthly rent is ₹18,500, payable before the 5th of each month.\n3. Deposit. A refundable security deposit of ₹37,000 is paid on signing.',
  '4. Maintenance. The Tenant keeps the premises clean and reports repairs promptly.\n5. Notice. Either party may end this agreement with one month written notice.\nSigned by both parties in the presence of two witnesses.',
];

export interface OcrRun {
  pages: { text: string; lines: never[] }[];
}
export const isOcrSupported = () => true;
export async function recogniseDocument(doc: ScanDocument): Promise<OcrRun> {
  void doc;
  return { pages: SAMPLE.map((text) => ({ text, lines: [] })) };
}
const CARD = 'A. Rao\nSenior Product Designer\nBrightleaf Technologies Pvt Ltd\n+91 98450 12345\nasha.rao@brightleaf.in\nwww.brightleaf.in\n4th Floor, 12 MG Road, Bengaluru 560001';
export async function recogniseImages(uris: readonly string[] = []): Promise<OcrRun> {
  return { pages: [{ text: uris.some((u) => u.includes('doc-card')) ? CARD : SAMPLE[0], lines: [] }] };
}
export function findMatches(pages: readonly { text: string }[], query: string): number[] {
  const q = query.trim().toLowerCase();
  return pages.map((p) => (q ? p.text.toLowerCase().split(q).length - 1 : 0));
}
export function joinPages(pages: readonly { text: string }[]): string {
  return pages.map((p) => p.text).join('\n\n');
}
export async function makeSearchablePdf(doc: ScanDocument): Promise<ScanDocument> {
  return doc;
}

/**
 * Business card → contact. Parses the OCR text of a card into contact fields
 * and builds a vCard 3.0 (.vcf) that any contacts app can import. Pure: no
 * React, no native code, fully unit-tested.
 */
export interface CardContact {
  name: string | null;
  title: string | null;
  company: string | null;
  phones: string[];
  emails: string[];
  websites: string[];
  address: string | null;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|io|co|biz|info|dev|app|ai|uk|us|de|fr|au|ca)(?:\/[^\s]*)?)\b/gi;
const PHONE = /(?:\+?\(?\d[\d\s().-]{7,}\d)/g;
const TITLE_WORDS =
  /\b(ceo|cto|cfo|coo|founder|co-founder|director|manager|engineer|developer|designer|consultant|officer|president|head|lead|executive|associate|partner|analyst|architect|specialist|advocate|doctor|dr\.|proprietor|owner|sales|marketing)\b/i;
const COMPANY_WORDS = /\b(pvt|private|ltd|limited|llp|llc|inc|corp|corporation|company|co\.|technologies|solutions|services|systems|industries|enterprises|group|studio|labs|associates|consultants|hospital|clinic|bank)\b/i;
const ADDRESS_WORDS = /\b(road|rd\.?|street|st\.?|avenue|ave|lane|nagar|floor|building|bldg|sector|block|plot|near|opp\.?|city|district|india|pin|zip|suite|colony|cross|main)\b|\b\d{6}\b|\b\d{5}(?:-\d{4})?\b/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function digits(s: string) {
  return s.replace(/[^\d+]/g, '');
}

export function parseBusinessCard(text: string): CardContact {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 0);

  const emails = [...new Set((text.match(EMAIL) ?? []).map((e) => e.toLowerCase()))];
  const websites = [
    ...new Set(
      (text.replace(EMAIL, ' ').match(URL) ?? [])
        .map((w) => w.replace(/[.,;]+$/, '').toLowerCase())
        .filter((w) => !emails.some((e) => e.endsWith(w))),
    ),
  ];
  const phones = [
    ...new Set(
      (text.replace(EMAIL, ' ').match(PHONE) ?? [])
        .map((p) => clean(p))
        .filter((p) => {
          const n = digits(p).replace('+', '').length;
          return n >= 8 && n <= 15;
        }),
    ),
  ];

  const isContactLine = (l: string) => EMAIL.test(l) || (PHONE.test(l) && digits(l).length >= 8) || URL.test(l);
  const plain = lines.filter((l) => {
    EMAIL.lastIndex = 0;
    PHONE.lastIndex = 0;
    URL.lastIndex = 0;
    const contact = isContactLine(l);
    EMAIL.lastIndex = 0;
    PHONE.lastIndex = 0;
    URL.lastIndex = 0;
    return !contact;
  });

  const title = plain.find((l) => TITLE_WORDS.test(l) && l.length <= 60) ?? null;
  const company = plain.find((l) => COMPANY_WORDS.test(l) && l !== title) ?? null;
  const addressLines = plain.filter((l) => ADDRESS_WORDS.test(l) && l !== title && l !== company);
  // A name is 2–4 words of letters, not a title/company/address line; prefer the first such line.
  const name =
    plain.find((l) => {
      if (l === title || l === company || addressLines.includes(l)) return false;
      const words = l.split(' ');
      return words.length >= 1 && words.length <= 4 && /^[A-Za-z][A-Za-z.'\- ]+$/.test(l) && l.length <= 40;
    }) ?? null;

  return {
    name,
    title,
    company,
    phones,
    emails,
    websites,
    address: addressLines.length > 0 ? addressLines.join(', ') : null,
  };
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function toVCard(c: CardContact): string {
  const name = c.name ?? c.company ?? 'Business card';
  const parts = name.split(' ');
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(last)};${esc(first)};;;`, `FN:${esc(name)}`];
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.title) lines.push(`TITLE:${esc(c.title)}`);
  c.phones.forEach((p) => lines.push(`TEL;TYPE=WORK,VOICE:${p}`));
  c.emails.forEach((e) => lines.push(`EMAIL;TYPE=INTERNET,WORK:${e}`));
  c.websites.forEach((w) => lines.push(`URL:${/^https?:/.test(w) ? w : `https://${w}`}`));
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${esc(c.address)};;;;`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}

export function hasContactDetails(c: CardContact): boolean {
  return c.phones.length > 0 || c.emails.length > 0 || c.websites.length > 0 || c.name !== null;
}

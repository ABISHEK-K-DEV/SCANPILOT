import { hasContactDetails, parseBusinessCard, toVCard } from '../businessCard';

const CARD = `Asha Rao
Senior Product Designer
Brightleaf Technologies Pvt Ltd
+91 98450 12345
asha.rao@brightleaf.in
www.brightleaf.in
4th Floor, 12 MG Road, Bengaluru 560001`;

describe('business card parsing', () => {
  it('extracts the contact fields', () => {
    const c = parseBusinessCard(CARD);
    expect(c.name).toBe('Asha Rao');
    expect(c.title).toBe('Senior Product Designer');
    expect(c.company).toBe('Brightleaf Technologies Pvt Ltd');
    expect(c.phones).toEqual(['+91 98450 12345']);
    expect(c.emails).toEqual(['asha.rao@brightleaf.in']);
    expect(c.websites).toEqual(['www.brightleaf.in']);
    expect(c.address).toBe('4th Floor, 12 MG Road, Bengaluru 560001');
    expect(hasContactDetails(c)).toBe(true);
  });

  it('finds several phone numbers and ignores short numbers', () => {
    const c = parseBusinessCard('John Smith\nTel (415) 555-0132\nMobile +1 415 555 0199\nSuite 12');
    expect(c.phones).toEqual(['(415) 555-0132', '+1 415 555 0199']);
    expect(c.name).toBe('John Smith');
  });

  it('builds an importable vCard', () => {
    const v = toVCard(parseBusinessCard(CARD));
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(v).toContain('N:Rao;Asha;;;');
    expect(v).toContain('FN:Asha Rao');
    expect(v).toContain('TEL;TYPE=WORK,VOICE:+91 98450 12345');
    expect(v).toContain('EMAIL;TYPE=INTERNET,WORK:asha.rao@brightleaf.in');
    expect(v).toContain('URL:https://www.brightleaf.in');
    expect(v).toContain('ADR;TYPE=WORK:;;4th Floor\\, 12 MG Road\\, Bengaluru 560001;;;;');
    expect(v.trimEnd().endsWith('END:VCARD')).toBe(true);
  });

  it('reports nothing found for blank text', () => {
    expect(hasContactDetails(parseBusinessCard('   '))).toBe(false);
  });
});

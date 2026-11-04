import { readFileSync } from 'fs';
import path from 'path';

import { LICENSE_TEXT } from '../appLicense';

const normalise = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('app licence', () => {
  it('matches the LICENSE file at the repository root', () => {
    const file = readFileSync(path.join(__dirname, '../../../LICENSE'), 'utf8');
    expect(normalise(LICENSE_TEXT)).toBe(normalise(file));
  });

  it('is declared as MIT in package.json', () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../../package.json'), 'utf8')) as { license?: string };
    expect(pkg.license).toBe('MIT');
  });
});

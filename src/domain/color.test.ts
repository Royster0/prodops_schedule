import { describe, expect, it } from 'vitest';
import { PALETTE, nextPaletteColor, textOn } from './color';

describe('color', () => {
  it('picks dark text on light fills and white on dark fills', () => {
    expect(textOn('#F2B517')).toBe('#1B1F24'); // Early yellow
    expect(textOn('#7FD1B9')).toBe('#1B1F24');
    expect(textOn('#2F5BD3')).toBe('#FFFFFF');
    expect(textOn('#0E7C6B')).toBe('#FFFFFF');
  });

  it('suggests the least used palette color', () => {
    expect(nextPaletteColor([])).toBe(PALETTE[0]);
    expect(nextPaletteColor([PALETTE[0], PALETTE[1]])).toBe(PALETTE[2]);
  });
});

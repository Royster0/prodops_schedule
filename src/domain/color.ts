import type { TimeOffType } from './types';

/** Colors for people, templates, tags and one-off shifts. */
export const PALETTE = [
  '#2F5BD3',
  '#0E7C6B',
  '#F2B517',
  '#7B3FA0',
  '#C8412A',
  '#4F7A28',
  '#C2386C',
  '#1677A8',
  '#D9B77A',
  '#4D5F70',
  '#7FD1B9',
  '#B7A4F0',
] as const;

export const TIME_OFF_COLORS: Record<TimeOffType, string> = {
  vacation: '#1677A8',
  sick: '#C8412A',
  personal: '#7B3FA0',
  unavailable: '#4D5F70',
};

export const TIME_OFF_LABELS: Record<TimeOffType, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
  unavailable: 'Unavailable',
};

export const TIME_OFF_TYPES: readonly TimeOffType[] = ['vacation', 'sick', 'personal', 'unavailable'];

const DARK_TEXT = '#1B1F24';
const LIGHT_TEXT = '#FFFFFF';

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Perceived brightness from 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const value = parseInt(hex.slice(1, 7), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Readable text color on a solid fill. */
export function textOn(hex: string): string {
  return luminance(hex) > 0.6 ? DARK_TEXT : LIGHT_TEXT;
}

/** The palette color used least among `used`, so new items get distinct colors. */
export function nextPaletteColor(used: readonly string[]): string {
  const counts = new Map<string, number>(PALETTE.map((c) => [c.toUpperCase(), 0]));
  for (const color of used) {
    const key = color.toUpperCase();
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  let best: string = PALETTE[0];
  let bestCount = Infinity;
  for (const color of PALETTE) {
    const n = counts.get(color.toUpperCase())!;
    if (n < bestCount) {
      best = color;
      bestCount = n;
    }
  }
  return best;
}

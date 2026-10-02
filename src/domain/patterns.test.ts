import { describe, expect, it } from 'vitest';
import { template } from '../testing/fixtures';
import { dateRange, daysBetween, mondayIndex } from './dates';
import { describePatternTotal, patternDayIndex, patternDayOn, resizePatternDays } from './patterns';
import { byId } from './seed';

describe('pattern parity', () => {
  const twoWeek = { length: 14 as const };

  it('treats the Monday-based week containing `from` as week A', () => {
    // Thu Oct 8 2026 starts the pattern; its week (Mon Oct 5) is week A.
    expect(patternDayIndex(twoWeek, '2026-10-08', '2026-10-08')).toBe(3);
    expect(patternDayIndex(twoWeek, '2026-10-08', '2026-10-05')).toBe(0);
    expect(patternDayIndex(twoWeek, '2026-10-08', '2026-10-11')).toBe(6);
    expect(patternDayIndex(twoWeek, '2026-10-08', '2026-10-12')).toBe(7);
    expect(patternDayIndex(twoWeek, '2026-10-08', '2026-10-19')).toBe(0);
  });

  it('never uses week B for one-week patterns', () => {
    expect(patternDayIndex({ length: 7 }, '2026-10-05', '2026-10-12')).toBe(0);
  });

  it('gives Mon to Thu in weeks 1 and 3 and Tue to Fri in weeks 2 and 4 for the alternating 4×10', () => {
    const L = 'L10';
    const alternating = {
      id: 'p',
      name: '4×10, alternating Mon and Fri off',
      length: 14 as const,
      days: [L, L, L, L, '', '', '', '', L, L, L, L, '', ''],
      order: 0,
    };
    const byWeek: number[][] = [[], [], [], []];
    for (const date of dateRange('2026-10-05', '2026-11-01')) {
      if (patternDayOn(alternating, '2026-10-05', date)) {
        byWeek[Math.floor(daysBetween('2026-10-05', date) / 7)].push(mondayIndex(date));
      }
    }
    expect(byWeek).toEqual([
      [0, 1, 2, 3],
      [1, 2, 3, 4],
      [0, 1, 2, 3],
      [1, 2, 3, 4],
    ]);
  });
});

describe('pattern totals', () => {
  const templates = byId([
    template('D8', { start: '08:00', end: '16:30', breakMins: 30 }),
    template('L10', { start: '07:00', end: '17:30', breakMins: 30 }),
  ]);

  it('sums hours and shifts', () => {
    expect(describePatternTotal({ length: 7, days: ['D8', 'D8', 'D8', 'D8', 'D8', '', ''] }, templates)).toBe(
      '40h a week, 5 shifts.',
    );
    expect(
      describePatternTotal({ length: 7, days: ['L10', 'L10', 'L10', 'L10', '', '', ''] }, templates),
    ).toBe('40h a week, 4 shifts.');
    expect(describePatternTotal({ length: 14, days: Array(14).fill('L10').fill('', 4, 10) }, templates)).toBe(
      '80h over 2 weeks, 8 shifts.',
    );
  });

  it('counts days with a deleted template as days off', () => {
    expect(describePatternTotal({ length: 7, days: ['gone', 'D8', '', '', '', '', ''] }, templates)).toBe(
      '8h a week, 1 shift.',
    );
  });

  it('resizes between one and two weeks', () => {
    const week = ['a', 'b', '', '', '', '', ''];
    expect(resizePatternDays(week, 14)).toEqual([...week, ...week]);
    expect(resizePatternDays([...week, ...week], 7)).toEqual(week);
  });
});

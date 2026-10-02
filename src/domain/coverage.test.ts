import { describe, expect, it } from 'vitest';
import { shift, timeOff } from '../testing/fixtures';
import { conflictingShiftIds, headcount, hourlyCoverage, timelineHours, trackPosition } from './coverage';

const everything = { shift: () => true };

describe('coverage', () => {
  it('counts people per hour, once each', () => {
    const people = [
      { employeeId: 'ana', today: [shift('a', 'ana', 'd', { start: '08:00', end: '10:00' })], yesterday: [] },
      {
        employeeId: 'ben',
        today: [
          shift('b1', 'ben', 'd', { start: '09:00', end: '11:00' }),
          shift('b2', 'ben', 'd', { start: '09:30', end: '10:30' }),
        ],
        yesterday: [],
      },
    ];
    // Hours 7..12: 7-8 nobody, 8-9 Ana, 9-10 both, 10-11 Ben, 11-12 nobody.
    expect(hourlyCoverage(people, everything, 7, 12)).toEqual([0, 1, 2, 1, 0]);
  });

  it('includes overnight spillover from the previous day', () => {
    const people = [
      {
        employeeId: 'ana',
        today: [],
        yesterday: [shift('n', 'ana', 'd-1', { start: '22:00', end: '06:00' })],
      },
    ];
    expect(hourlyCoverage(people, everything, 0, 8)).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);
    expect(headcount(people, everything)).toBe(0);
  });

  it('only counts matching shifts', () => {
    const people = [
      { employeeId: 'ana', today: [shift('a', 'ana', 'd', { templateId: 'L10' })], yesterday: [] },
      { employeeId: 'ben', today: [shift('b', 'ben', 'd', { templateId: 'D8' })], yesterday: [] },
    ];
    const longDayOnly = { shift: (s: { templateId: string | null }) => s.templateId === 'L10' };
    expect(headcount(people, longDayOnly)).toBe(1);
    expect(hourlyCoverage(people, longDayOnly, 8, 9)).toEqual([1]);
  });
});

describe('timeline hours', () => {
  it('uses the settings range by default and widens to fit shifts', () => {
    expect(timelineHours(5, 23, [], [])).toEqual({ start: 5, end: 23 });
    expect(timelineHours(5, 23, [shift('a', 'ana', 'd', { start: '04:30', end: '12:00' })], [])).toEqual({
      start: 4,
      end: 23,
    });
    expect(timelineHours(5, 23, [shift('a', 'ana', 'd', { start: '22:00', end: '06:00' })], [])).toEqual({
      start: 5,
      end: 24,
    });
    expect(timelineHours(5, 23, [], [shift('n', 'ana', 'd-1', { start: '22:00', end: '04:00' })])).toEqual({
      start: 0,
      end: 23,
    });
  });
});

describe('conflicts', () => {
  it('flags shifts on time off days', () => {
    const s = shift('a', 'ana', '2026-10-01');
    expect([...conflictingShiftIds([s], [], timeOff('t', 'ana', '2026-10-01', '2026-10-01'))]).toEqual(['a']);
  });

  it('flags overlapping shifts but not back-to-back ones', () => {
    const early = shift('e', 'ana', 'd', { start: '06:00', end: '14:00' });
    const late = shift('l', 'ana', 'd', { start: '14:00', end: '22:00' });
    const middle = shift('m', 'ana', 'd', { start: '12:00', end: '16:00' });
    expect(conflictingShiftIds([early, late], [], undefined).size).toBe(0);
    expect([...conflictingShiftIds([early, late, middle], [], undefined)].sort()).toEqual(['e', 'l', 'm']);
  });

  it('flags a shift overlapping last night’s spillover', () => {
    const night = shift('n', 'ana', 'd-1', { start: '22:00', end: '07:00' });
    const early = shift('e', 'ana', 'd', { start: '06:00', end: '14:00' });
    expect([...conflictingShiftIds([early], [night], undefined)]).toEqual(['e']);
  });
});

describe('time track', () => {
  it('places a shift within the day range', () => {
    const pos = trackPosition('08:00', '16:30', 5, 23);
    expect(pos.left).toBeCloseTo(3 / 18);
    expect(pos.width).toBeCloseTo(8.5 / 18);
  });

  it('clamps shifts that run past the range', () => {
    const pos = trackPosition('22:00', '06:00', 5, 23);
    expect(pos.left).toBeCloseTo(17 / 18);
    expect(pos.width).toBeCloseTo(1 / 18);
  });
});

describe('dayCoverage', () => {
  it('matches hourly coverage and caches per slice', async () => {
    const { dayCoverage } = await import('./coverage');
    const today = [[shift('a', 'ana', 'd', { start: '08:00', end: '10:00' })], []];
    const yesterday = [[], [shift('n', 'ben', 'd-1', { start: '22:00', end: '06:00' })]];
    const first = dayCoverage(today, yesterday, everything, 5, 10);
    expect(first).toEqual({ counts: [1, 0, 0, 1, 1], total: 1 });
    expect(dayCoverage(today, yesterday, everything, 5, 10)).toBe(first);
    expect(dayCoverage(today, yesterday, everything, 6, 10)).not.toBe(first);
  });
});

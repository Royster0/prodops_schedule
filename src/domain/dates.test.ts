import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dateRange,
  dayOfWeek,
  daysBetween,
  isISODate,
  monthBounds,
  monthGrid,
  mondayIndex,
  overlapDays,
  startOfWeek,
  today,
} from './dates';

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is not shifted by daylight saving changes', () => {
    // US DST starts Mar 8 2026 and ends Nov 1 2026; EU on Mar 29 and Oct 25.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-01', '2026-11-30')).toBe(60);
  });

  it('knows the day of the week', () => {
    expect(dayOfWeek('2026-10-02')).toBe(5); // Friday
    expect(mondayIndex('2026-10-02')).toBe(4);
    expect(mondayIndex('2026-10-04')).toBe(6); // Sunday
    expect(mondayIndex('2026-09-28')).toBe(0); // Monday
  });

  it('finds the start of the week for either week start', () => {
    expect(startOfWeek('2026-10-02', 1)).toBe('2026-09-28');
    expect(startOfWeek('2026-10-02', 0)).toBe('2026-09-27');
    expect(startOfWeek('2026-09-28', 1)).toBe('2026-09-28');
    expect(startOfWeek('2026-10-04', 1)).toBe('2026-09-28');
    expect(startOfWeek('2026-10-04', 0)).toBe('2026-10-04');
  });

  it('counts days between dates in either direction', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0);
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
  });

  it('lists an inclusive date range', () => {
    expect(dateRange('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('gives month bounds, including leap years', () => {
    expect(monthBounds('2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthBounds('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('builds whole weeks covering a month', () => {
    const grid = monthGrid('2026-10-15', 1);
    expect(grid[0][0]).toBe('2026-09-28');
    expect(grid[grid.length - 1][6]).toBe('2026-11-01');
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid).toHaveLength(5);
    expect(monthGrid('2026-10-15', 0)[0][0]).toBe('2026-09-27');
  });

  it('adds months and clamps the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-10-01', -1)).toBe('2026-09-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('validates ISO dates', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-2-3')).toBe(false);
    expect(isISODate(20261002)).toBe(false);
  });

  it('counts overlapping days', () => {
    expect(overlapDays('2026-10-01', '2026-10-10', '2026-10-08', '2026-10-20')).toBe(3);
    expect(overlapDays('2026-10-01', '2026-10-05', '2026-10-06', '2026-10-20')).toBe(0);
  });

  it('reads today from local time', () => {
    expect(today(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02');
    expect(today(new Date(2026, 9, 3, 0, 1))).toBe('2026-10-03');
  });
});

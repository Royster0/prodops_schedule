import { describe, expect, it } from 'vitest';
import { count, formatDateRange, formatDayLabel, formatMonthYear, initials, joinList } from './format';
import { periodFor, periodLabel, shiftAnchor } from './period';

describe('format', () => {
  it('formats date ranges like the header', () => {
    expect(formatDateRange('2026-09-28', '2026-10-04')).toBe('Sep 28–Oct 4');
    expect(formatDateRange('2026-10-05', '2026-10-11')).toBe('Oct 5–11');
    expect(formatDayLabel('2026-10-02')).toBe('Fri, Oct 2');
    expect(formatMonthYear('2026-10-02')).toBe('October 2026');
  });

  it('pluralizes counts with separators', () => {
    expect(count(1, 'shift')).toBe('1 shift');
    expect(count(2100, 'shift')).toBe('2,100 shifts');
    expect(count(2, 'person', 'people')).toBe('2 people');
  });

  it('joins lists and makes initials', () => {
    expect(joinList(['Mon', 'Wed', 'Fri'])).toBe('Mon, Wed and Fri');
    expect(joinList(['Mon'])).toBe('Mon');
    expect(initials('Ana Ruiz')).toBe('AR');
    expect(initials('  kim  ')).toBe('KI');
    expect(initials('Mary Jo Smith')).toBe('MS');
  });
});

describe('period', () => {
  it('covers a week from the configured week start', () => {
    const week = periodFor('week', '2026-10-02', 1);
    expect(week.dates).toHaveLength(7);
    expect(periodLabel(week)).toBe('Sep 28–Oct 4');
    expect(periodFor('twoWeeks', '2026-10-02', 0).dates[0]).toBe('2026-09-27');
  });

  it('covers whole weeks in month view but labels the month', () => {
    const month = periodFor('month', '2026-10-02', 1);
    expect(month.start).toBe('2026-10-01');
    expect(month.end).toBe('2026-10-31');
    expect(month.dates[0]).toBe('2026-09-28');
    expect(periodLabel(month)).toBe('October 2026');
    expect(periodLabel(month, true)).toBe('Oct 2026');
  });

  it('moves by one period', () => {
    expect(shiftAnchor('day', '2026-10-02', 1)).toBe('2026-10-03');
    expect(shiftAnchor('twoWeeks', '2026-10-02', -1)).toBe('2026-09-18');
    expect(shiftAnchor('month', '2026-10-31', 1)).toBe('2026-11-01');
  });
});

import { describe, expect, it } from 'vitest';
import { holiday, makeData } from '../testing/fixtures';
import { ChangeSet } from './changeSet';
import {
  addCommonHolidays,
  addHolidayRange,
  groupHolidays,
  lastWeekday,
  nthWeekday,
  observed,
  usHolidays,
} from './holidays';

describe('US holidays', () => {
  it('lists the 2026 dates', () => {
    expect(usHolidays(2026).map((h) => `${h.date} ${h.name}`)).toEqual([
      "2026-01-01 New Year's Day",
      '2026-01-19 Martin Luther King Jr. Day',
      "2026-02-16 Presidents' Day",
      '2026-05-25 Memorial Day',
      '2026-06-19 Juneteenth',
      '2026-07-03 Independence Day', // July 4 2026 is a Saturday
      '2026-09-07 Labor Day',
      '2026-11-26 Thanksgiving',
      '2026-11-27 Day after Thanksgiving',
      '2026-12-25 Christmas Day',
    ]);
  });

  it('moves Saturday holidays to Friday and Sunday holidays to Monday', () => {
    expect(observed('2026-07-04')).toBe('2026-07-03');
    expect(observed('2027-12-25')).toBe('2027-12-24'); // Saturday
    expect(observed('2022-12-25')).toBe('2022-12-26'); // Sunday
    expect(usHolidays(2028).find((h) => h.name === "New Year's Day")?.date).toBe('2027-12-31');
  });

  it('finds nth and last weekdays', () => {
    expect(nthWeekday(2027, 1, 1, 3)).toBe('2027-01-18');
    expect(nthWeekday(2027, 11, 4, 4)).toBe('2027-11-25');
    expect(lastWeekday(2027, 5, 1)).toBe('2027-05-31');
  });

  it('adds holidays for several years without duplicating dates', () => {
    const changes = new ChangeSet(makeData({ holidays: [holiday('x', '2026-12-25', 'Christmas')] }));
    expect(addCommonHolidays(changes, [2026, 2027])).toBe(19);
    expect(addCommonHolidays(changes, [2026, 2027])).toBe(0);
    expect(changes.list('holidays').filter((h) => h.date === '2026-12-25')).toHaveLength(1);
  });
});

describe('holiday ranges', () => {
  it('adds one holiday per day with the same name', () => {
    const changes = new ChangeSet(makeData());
    expect(addHolidayRange(changes, 'Winter break', '2026-12-28', '2027-01-01')).toEqual({
      added: 5,
      skipped: 0,
    });
    expect(
      changes
        .list('holidays')
        .map((h) => h.date)
        .sort(),
    ).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
    expect(changes.list('holidays').every((h) => h.name === 'Winter break')).toBe(true);
  });

  it('skips dates that already have a holiday', () => {
    const changes = new ChangeSet(makeData({ holidays: [holiday('x', '2026-12-25', 'Christmas Day')] }));
    expect(addHolidayRange(changes, 'Winter break', '2026-12-24', '2026-12-26')).toEqual({
      added: 2,
      skipped: 1,
    });
    expect(changes.get('holidays', 'x')?.name).toBe('Christmas Day');
  });

  it('adds a single day when the range is one date', () => {
    const changes = new ChangeSet(makeData());
    expect(addHolidayRange(changes, 'Founders Day', '2026-10-09', '2026-10-09')).toEqual({
      added: 1,
      skipped: 0,
    });
  });

  it('groups consecutive days with the same name', () => {
    const groups = groupHolidays([
      holiday('c', '2026-12-30', 'Winter break'),
      holiday('a', '2026-12-28', 'Winter break'),
      holiday('b', '2026-12-29', 'Winter break'),
      holiday('d', '2026-12-31', "New Year's Eve"),
      holiday('e', '2027-01-02', 'Winter break'),
    ]);
    expect(groups.map((g) => `${g.name} ${g.start}..${g.end} ${g.ids.join(',')}`)).toEqual([
      'Winter break 2026-12-28..2026-12-30 a,b,c',
      "New Year's Eve 2026-12-31..2026-12-31 d",
      'Winter break 2027-01-02..2027-01-02 e',
    ]);
  });
});

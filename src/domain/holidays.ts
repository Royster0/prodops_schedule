import type { ChangeSet } from './changeSet';
import { addDays, dayOfWeek, daysInMonth, makeDate } from './dates';
import { createId } from './ids';
import type { ISODate } from './types';

/** Common US holidays, with fixed-date holidays moved to the nearest weekday when observed. */

const MONDAY = 1;
const THURSDAY = 4;

/** The nth (1-based) weekday of a month, e.g. the 3rd Monday of January. */
export function nthWeekday(year: number, month: number, weekday: number, n: number): ISODate {
  const first = makeDate(year, month, 1);
  const offset = (weekday - dayOfWeek(first) + 7) % 7;
  return addDays(first, offset + (n - 1) * 7);
}

/** The last given weekday of a month, e.g. the last Monday of May. */
export function lastWeekday(year: number, month: number, weekday: number): ISODate {
  const last = makeDate(year, month, daysInMonth(year, month));
  const offset = (dayOfWeek(last) - weekday + 7) % 7;
  return addDays(last, -offset);
}

/** Saturday moves to Friday, Sunday to Monday. */
export function observed(date: ISODate): ISODate {
  const dow = dayOfWeek(date);
  if (dow === 6) return addDays(date, -1);
  if (dow === 0) return addDays(date, 1);
  return date;
}

export function usHolidays(year: number): { date: ISODate; name: string }[] {
  const thanksgiving = nthWeekday(year, 11, THURSDAY, 4);
  return [
    { date: observed(makeDate(year, 1, 1)), name: "New Year's Day" },
    { date: nthWeekday(year, 1, MONDAY, 3), name: 'Martin Luther King Jr. Day' },
    { date: nthWeekday(year, 2, MONDAY, 3), name: "Presidents' Day" },
    { date: lastWeekday(year, 5, MONDAY), name: 'Memorial Day' },
    { date: observed(makeDate(year, 6, 19)), name: 'Juneteenth' },
    { date: observed(makeDate(year, 7, 4)), name: 'Independence Day' },
    { date: nthWeekday(year, 9, MONDAY, 1), name: 'Labor Day' },
    { date: thanksgiving, name: 'Thanksgiving' },
    { date: addDays(thanksgiving, 1), name: 'Day after Thanksgiving' },
    { date: observed(makeDate(year, 12, 25)), name: 'Christmas Day' },
  ];
}

/** Adds the common US holidays for the given years, skipping dates already present. Returns how many. */
export function addCommonHolidays(changes: ChangeSet, years: readonly number[]): number {
  const taken = new Set(changes.list('holidays').map((h) => h.date));
  let added = 0;
  for (const year of years) {
    for (const holiday of usHolidays(year)) {
      if (taken.has(holiday.date)) continue;
      taken.add(holiday.date);
      changes.put('holidays', { id: createId(), ...holiday });
      added++;
    }
  }
  return added;
}

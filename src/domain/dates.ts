import type { ISODate } from './types';

/*
 * Local calendar date helpers. Dates are plain 'YYYY-MM-DD' strings.
 * Date objects are only built at local noon so a DST change never moves a day,
 * and nothing is converted through UTC.
 */

const DAY_MS = 86_400_000;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parts(date: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function makeDate(year: number, month: number, day: number): ISODate {
  return fromLocalDate(new Date(year, month - 1, day, 12));
}

/** A Date at local noon on the given calendar date. */
export function toLocalDate(date: ISODate): Date {
  const { year, month, day } = parts(date);
  return new Date(year, month - 1, day, 12);
}

export function fromLocalDate(date: Date): ISODate {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(now: Date = new Date()): ISODate {
  return fromLocalDate(now);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0, 12).getDate();
}

export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parts(date);
  return fromLocalDate(new Date(year, month - 1, day + days, 12));
}

/** Adds months, clamping the day to the end of the target month. */
export function addMonths(date: ISODate, months: number): ISODate {
  const { year, month, day } = parts(date);
  const first = new Date(year, month - 1 + months, 1, 12);
  const clamped = Math.min(day, daysInMonth(first.getFullYear(), first.getMonth() + 1));
  return makeDate(first.getFullYear(), first.getMonth() + 1, clamped);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: ISODate): number {
  return toLocalDate(date).getDay();
}

/** 0 = Monday ... 6 = Sunday. */
export function mondayIndex(date: ISODate): number {
  return (dayOfWeek(date) + 6) % 7;
}

export function isWeekend(date: ISODate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

/** The first day of the week containing `date`. weekStart 0 = Sunday, 1 = Monday. */
export function startOfWeek(date: ISODate, weekStart: 0 | 1): ISODate {
  const offset = (dayOfWeek(date) - weekStart + 7) % 7;
  return addDays(date, -offset);
}

/** Whole days from `a` to `b`. Positive when `b` is later. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toLocalDate(b).getTime() - toLocalDate(a).getTime()) / DAY_MS);
}

/** Every date from `a` through `b`, inclusive. Empty when `b` is before `a`. */
export function dateRange(a: ISODate, b: ISODate): ISODate[] {
  const count = daysBetween(a, b) + 1;
  const result: ISODate[] = [];
  for (let i = 0; i < count; i++) result.push(addDays(a, i));
  return result;
}

export function monthBounds(date: ISODate): { start: ISODate; end: ISODate } {
  const { year, month } = parts(date);
  return { start: makeDate(year, month, 1), end: makeDate(year, month, daysInMonth(year, month)) };
}

/** Whole weeks covering the month of `date`, as rows of 7 dates. */
export function monthGrid(date: ISODate, weekStart: 0 | 1): ISODate[][] {
  const { start, end } = monthBounds(date);
  const first = startOfWeek(start, weekStart);
  const last = addDays(startOfWeek(end, weekStart), 6);
  const days = dateRange(first, last);
  const weeks: ISODate[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Days in [a, b] that fall in [c, d]. Both ranges inclusive. */
export function overlapDays(a: ISODate, b: ISODate, c: ISODate, d: ISODate): number {
  const start = a > c ? a : c;
  const end = b < d ? b : d;
  return start > end ? 0 : daysBetween(start, end) + 1;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

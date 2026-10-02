import { MONTH_LONG, MONTH_SHORT, WEEKDAY_SHORT, dayOfWeek, parts } from './dates';
import type { ISODate } from './types';

/** Human-readable labels for dates, counts and lists. */

/** 'Oct 5' */
export function formatShortDate(date: ISODate): string {
  const { month, day } = parts(date);
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

/** 'Fri, Oct 2' */
export function formatDayLabel(date: ISODate): string {
  return `${WEEKDAY_SHORT[dayOfWeek(date)]}, ${formatShortDate(date)}`;
}

/** 'October 2026' */
export function formatMonthYear(date: ISODate): string {
  const { year, month } = parts(date);
  return `${MONTH_LONG[month - 1]} ${year}`;
}

/** 'Sep 28–Oct 4', or 'Oct 5–11' within one month. */
export function formatDateRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatShortDate(start);
  const a = parts(start);
  const b = parts(end);
  if (a.year === b.year && a.month === b.month) return `${MONTH_SHORT[a.month - 1]} ${a.day}–${b.day}`;
  return `${formatShortDate(start)}–${formatShortDate(end)}`;
}

/** 2100 -> '2,100' */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** count(1, 'shift') -> '1 shift', count(80, 'shift') -> '80 shifts'. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

/** ['a', 'b', 'c'] -> 'a, b and c' */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** 'Ana Ruiz' -> 'AR', 'Kim' -> 'KI'. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

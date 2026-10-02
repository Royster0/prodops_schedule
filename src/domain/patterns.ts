import { daysBetween, mondayIndex, startOfWeek } from './dates';
import { formatHours, shiftHours } from './time';
import type { ID, ISODate, Pattern, ShiftTemplate } from './types';
import { count } from './format';

/** Repeating 1 or 2 week work patterns. */

/**
 * Which pattern day applies on `date` when the pattern starts at `from`.
 * Week A is the Monday-based week containing `from`; two-week patterns
 * alternate A and B from there.
 */
export function patternDayIndex(pattern: Pick<Pattern, 'length'>, from: ISODate, date: ISODate): number {
  const weekOffset = Math.floor(daysBetween(startOfWeek(from, 1), date) / 7);
  const isWeekB = pattern.length === 14 && Math.abs(weekOffset) % 2 === 1;
  return mondayIndex(date) + (isWeekB ? 7 : 0);
}

/** The template id scheduled on `date`, or '' for a day off. */
export function patternDayOn(pattern: Pattern, from: ISODate, date: ISODate): ID | '' {
  return pattern.days[patternDayIndex(pattern, from, date)] ?? '';
}

/** "40h a week, 4 shifts." or "80h over 2 weeks, 8 shifts." Missing templates count as days off. */
export function describePatternTotal(
  pattern: Pick<Pattern, 'length' | 'days'>,
  templates: Readonly<Record<ID, ShiftTemplate>>,
): string {
  let hours = 0;
  let shifts = 0;
  for (const id of pattern.days) {
    const template = id ? templates[id] : undefined;
    if (!template) continue;
    shifts++;
    hours += shiftHours(template.start, template.end, template.breakMins);
  }
  const period = pattern.length === 14 ? 'over 2 weeks' : 'a week';
  return `${formatHours(hours)} ${period}, ${count(shifts, 'shift')}.`;
}

/** Resizes a pattern's days when switching between 1 and 2 weeks. Week B starts as a copy of week A. */
export function resizePatternDays(days: readonly (ID | '')[], length: 7 | 14): (ID | '')[] {
  if (length === 7) return days.slice(0, 7);
  return days.length >= 14 ? days.slice(0, 14) : [...days.slice(0, 7), ...days.slice(0, 7)];
}

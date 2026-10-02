import type { Matcher } from './filters';
import { shiftInterval } from './shifts';
import { MINUTES_PER_DAY } from './time';
import type { ID, Shift, TimeOff } from './types';

/** Headcount per hour, day totals, timeline bounds and conflict warnings. */

export interface DayShifts {
  employeeId: ID;
  /** Shifts on this date. */
  today: readonly Shift[];
  /** Shifts on the previous date, which may spill past midnight into this one. */
  yesterday: readonly Shift[];
}

/** Minutes relative to this date's midnight that a shift occupies. */
function intervalsOnDay(person: DayShifts, matches: (shift: Shift) => boolean): [number, number][] {
  const result: [number, number][] = [];
  for (const shift of person.today) if (matches(shift)) result.push(shiftInterval(shift));
  for (const shift of person.yesterday) {
    if (!matches(shift)) continue;
    const [start, end] = shiftInterval(shift);
    if (end > MINUTES_PER_DAY) result.push([start - MINUTES_PER_DAY, end - MINUTES_PER_DAY]);
  }
  return result;
}

/**
 * People working each hour from `fromHour` up to `toHour`, counting each person
 * once per hour. Includes overnight spillover from the day before.
 */
export function hourlyCoverage(
  people: readonly DayShifts[],
  matcher: Pick<Matcher, 'shift'>,
  fromHour: number,
  toHour: number,
): number[] {
  const counts = new Array<number>(Math.max(0, toHour - fromHour)).fill(0);
  for (const person of people) {
    const intervals = intervalsOnDay(person, matcher.shift);
    if (intervals.length === 0) continue;
    for (let i = 0; i < counts.length; i++) {
      const slotStart = (fromHour + i) * 60;
      const slotEnd = slotStart + 60;
      if (intervals.some(([start, end]) => start < slotEnd && end > slotStart)) counts[i]++;
    }
  }
  return counts;
}

/** "N on": people with a matching shift on this date. */
export function headcount(people: readonly DayShifts[], matcher: Pick<Matcher, 'shift'>): number {
  return people.filter((person) => person.today.some(matcher.shift)).length;
}

/**
 * Hours shown in Day view: the settings range, widened to fit the day's shifts.
 * Overnight shifts widen it to midnight; spillover that ends before the range
 * starts widens it to 0.
 */
export function timelineHours(
  dayStart: number,
  dayEnd: number,
  shifts: readonly Shift[],
  spillover: readonly Shift[],
): { start: number; end: number } {
  let start = dayStart;
  let end = dayEnd;
  for (const shift of shifts) {
    const [from, to] = shiftInterval(shift);
    start = Math.min(start, Math.floor(from / 60));
    end = Math.max(end, Math.min(24, Math.ceil(to / 60)));
  }
  for (const shift of spillover) {
    const [, to] = shiftInterval(shift);
    if (to > MINUTES_PER_DAY && to - MINUTES_PER_DAY <= dayStart * 60) start = 0;
  }
  return { start, end };
}

/**
 * Shifts that need a red outline: on a time off day, or overlapping another
 * shift for the same person (including spillover from the day before).
 */
export function conflictingShiftIds(
  today: readonly Shift[],
  yesterday: readonly Shift[],
  timeOff: TimeOff | undefined,
): Set<ID> {
  const flagged = new Set<ID>();
  if (timeOff) today.forEach((s) => flagged.add(s.id));
  const intervals = today.map((shift) => ({ id: shift.id, range: shiftInterval(shift) }));
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      if (overlaps(intervals[i].range, intervals[j].range)) {
        flagged.add(intervals[i].id);
        flagged.add(intervals[j].id);
      }
    }
  }
  for (const prev of yesterday) {
    const [start, end] = shiftInterval(prev);
    if (end <= MINUTES_PER_DAY) continue;
    const spill: [number, number] = [start - MINUTES_PER_DAY, end - MINUTES_PER_DAY];
    for (const { id, range } of intervals) if (overlaps(spill, range)) flagged.add(id);
  }
  return flagged;
}

function overlaps([a1, a2]: [number, number], [b1, b2]: [number, number]): boolean {
  return a1 < b2 && b1 < a2;
}

/** Where a time range sits within [fromHour, toHour], as fractions 0..1 for the time track. */
export function trackPosition(
  start: string,
  end: string,
  fromHour: number,
  toHour: number,
): { left: number; width: number } {
  const span = (toHour - fromHour) * 60;
  const [from, to] = shiftInterval({ start, end });
  const clampedFrom = Math.min(Math.max(from - fromHour * 60, 0), span);
  const clampedTo = Math.min(Math.max(to - fromHour * 60, 0), span);
  return { left: clampedFrom / span, width: Math.max(clampedTo - clampedFrom, 0) / span };
}

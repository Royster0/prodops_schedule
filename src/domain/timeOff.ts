import type { ChangeSet } from './changeSet';
import { addDays, dateRange, daysBetween } from './dates';
import { createId } from './ids';
import type { ID, ISODate, TimeOff, TimeOffType } from './types';

/** Time off is stored as inclusive date ranges that never overlap for one person. */

/**
 * The parts of a range left after removing [a, b]: none, one (trimmed) or two
 * (split). The first part keeps the original id.
 */
export function subtractRange(record: TimeOff, a: ISODate, b: ISODate): TimeOff[] {
  if (b < record.start || a > record.end) return [record];
  const parts: TimeOff[] = [];
  if (record.start < a) parts.push({ ...record, end: addDays(a, -1) });
  if (b < record.end) {
    const tail = { ...record, start: addDays(b, 1) };
    parts.push(parts.length === 0 ? tail : { ...tail, id: createId() });
  }
  return parts;
}

/** Removes [a, b] from one record: trims, splits in two, or deletes it. */
export function removeDays(changes: ChangeSet, record: TimeOff, a: ISODate, b: ISODate): void {
  const parts = subtractRange(record, a, b);
  if (parts.length === 1 && parts[0] === record) return;
  if (parts.length === 0 || parts[0].id !== record.id) changes.remove('timeOff', record.id);
  for (const part of parts) changes.put('timeOff', part);
}

/** Removes [a, b] from every time off record for one person. */
export function clearTimeOff(changes: ChangeSet, employeeId: ID, a: ISODate, b: ISODate): void {
  for (const record of changes.timeOffFor(employeeId)) {
    if (record.start <= b && record.end >= a) removeDays(changes, record, a, b);
  }
}

/**
 * Marks one day as time off of `type`, merging with a neighboring record of the
 * same person and type so painting a run of days makes one range.
 */
export function addDay(changes: ChangeSet, employeeId: ID, date: ISODate, type: TimeOffType): void {
  const existing = changes.timeOffOn(employeeId, date);
  if (existing?.type === type) return;
  if (existing) removeDays(changes, existing, date, date);

  const sameType = changes.timeOffFor(employeeId).filter((t) => t.type === type);
  const before = sameType.find((t) => t.end === addDays(date, -1));
  const after = sameType.find((t) => t.start === addDays(date, 1));

  if (before && after) {
    changes.put('timeOff', { ...before, end: after.end });
    changes.remove('timeOff', after.id);
  } else if (before) {
    changes.put('timeOff', { ...before, end: date });
  } else if (after) {
    changes.put('timeOff', { ...after, start: date });
  } else {
    changes.put('timeOff', { id: createId(), employeeId, start: date, end: date, type, note: '' });
  }
}

export interface TimeOffInput {
  employeeId: ID;
  start: ISODate;
  end: ISODate;
  type: TimeOffType;
  note: string;
}

/**
 * Adds a range from a form. Overlapping ranges for the person are trimmed and,
 * when asked, their shifts in the range are removed. Returns the shifts removed.
 */
export function addRange(
  changes: ChangeSet,
  input: TimeOffInput,
  removeShifts: boolean,
  id: ID = createId(),
): number {
  clearTimeOff(changes, input.employeeId, input.start, input.end);
  changes.put('timeOff', { id, ...input });
  return removeShifts ? removeShiftsInRange(changes, input.employeeId, input.start, input.end) : 0;
}

/** Edits a range: frees its old days, then adds it back with the new values. */
export function updateRange(changes: ChangeSet, id: ID, input: TimeOffInput, removeShifts: boolean): number {
  const old = changes.get('timeOff', id);
  if (old) changes.remove('timeOff', id);
  return addRange(changes, input, removeShifts, id);
}

export function removeShiftsInRange(changes: ChangeSet, employeeId: ID, a: ISODate, b: ISODate): number {
  let removed = 0;
  for (const date of dateRange(a, b)) {
    for (const shift of changes.shiftsAt(employeeId, date)) {
      changes.remove('shifts', shift.id);
      removed++;
    }
  }
  return removed;
}

/** Inclusive day count of a range. */
export function rangeLength(start: ISODate, end: ISODate): number {
  return Math.abs(daysBetween(start, end)) + 1;
}

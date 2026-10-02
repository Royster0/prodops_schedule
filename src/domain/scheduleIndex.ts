import { cellKey } from './changeSet';
import { dateRange } from './dates';
import { byStartTime } from './shifts';
import type { ID, ISODate, Shift, TimeOff } from './types';

/**
 * Per-cell lookups for rendering. Arrays are reused from the previous index when
 * a cell's shifts did not change, so memoized cells skip re-rendering.
 */

export const NO_SHIFTS: readonly Shift[] = Object.freeze([]);

export type ShiftCells = ReadonlyMap<string, readonly Shift[]>;
export type TimeOffCells = ReadonlyMap<string, TimeOff>;

export function buildShiftCells(shifts: Readonly<Record<ID, Shift>>, previous?: ShiftCells): ShiftCells {
  const cells = new Map<string, Shift[]>();
  for (const shift of Object.values(shifts)) {
    const key = cellKey(shift.employeeId, shift.date);
    const list = cells.get(key);
    if (list) list.push(shift);
    else cells.set(key, [shift]);
  }
  const result = new Map<string, readonly Shift[]>();
  for (const [key, list] of cells) {
    list.sort(byStartTime);
    const old = previous?.get(key);
    result.set(key, old && sameItems(old, list) ? old : list);
  }
  return result;
}

export function buildTimeOffCells(timeOff: Readonly<Record<ID, TimeOff>>): TimeOffCells {
  const cells = new Map<string, TimeOff>();
  for (const record of Object.values(timeOff)) {
    for (const date of dateRange(record.start, record.end)) cells.set(cellKey(record.employeeId, date), record);
  }
  return cells;
}

export function shiftsIn(cells: ShiftCells, employeeId: ID, date: ISODate): readonly Shift[] {
  return cells.get(cellKey(employeeId, date)) ?? NO_SHIFTS;
}

export function timeOffIn(cells: TimeOffCells, employeeId: ID, date: ISODate): TimeOff | undefined {
  return cells.get(cellKey(employeeId, date));
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

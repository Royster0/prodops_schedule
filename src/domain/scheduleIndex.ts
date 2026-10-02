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
    for (const date of dateRange(record.start, record.end))
      cells.set(cellKey(record.employeeId, date), record);
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

/*
 * Row and day slices. A Week row needs one person's shifts across the dates
 * shown; a Month day needs everyone's shifts on one date. These return the
 * previous slice when nothing in it changed, so memoized rows and days only
 * re-render when one of their own cells did.
 */

const MAX_CACHED_SLICES = 4000;
const sliceCache = new Map<string, readonly unknown[]>();

function shared<T>(key: string, next: readonly T[]): readonly T[] {
  const previous = sliceCache.get(key) as readonly T[] | undefined;
  if (previous && sameItems(previous, next)) return previous;
  if (sliceCache.size > MAX_CACHED_SLICES) sliceCache.clear();
  sliceCache.set(key, next);
  return next;
}

/** One person's shifts on each date, in date order. */
export function rowShifts(
  cells: ShiftCells,
  employeeId: ID,
  dates: readonly ISODate[],
): readonly (readonly Shift[])[] {
  return shared(
    `row-shifts|${employeeId}|${dates[0]}|${dates.length}`,
    dates.map((d) => shiftsIn(cells, employeeId, d)),
  );
}

/** One person's time off on each date. */
export function rowTimeOff(
  cells: TimeOffCells,
  employeeId: ID,
  dates: readonly ISODate[],
): readonly (TimeOff | undefined)[] {
  return shared(
    `row-off|${employeeId}|${dates[0]}|${dates.length}`,
    dates.map((d) => timeOffIn(cells, employeeId, d)),
  );
}

/** Everyone's shifts on one date, in the given people order. */
export function dayShifts(
  cells: ShiftCells,
  employeeIds: readonly ID[],
  date: ISODate,
): readonly (readonly Shift[])[] {
  return shared(
    `day-shifts|${date}|${employeeIds.join()}`,
    employeeIds.map((id) => shiftsIn(cells, id, date)),
  );
}

/** Everyone's time off on one date. */
export function dayTimeOff(
  cells: TimeOffCells,
  employeeIds: readonly ID[],
  date: ISODate,
): readonly (TimeOff | undefined)[] {
  return shared(
    `day-off|${date}|${employeeIds.join()}`,
    employeeIds.map((id) => timeOffIn(cells, id, date)),
  );
}

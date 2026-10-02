import { cellKey } from '../domain/changeSet';
import { dateRange } from '../domain/dates';
import type { ChangeOp, ID, ISODate, TimeOff } from '../domain/types';

/*
 * Remembers what the person created in this session, so only that animates in.
 * Shifts are tracked by id. Time off is tracked by cell, because painting a day
 * often extends an existing range rather than creating a record.
 * Kept outside React state on purpose: it never needs to trigger a render.
 */

const FRESH_FOR_MS = 1200;
const createdAt = new Map<string, number>();

function timeOffCells(record: TimeOff | null): Set<string> {
  const cells = new Set<string>();
  if (record) for (const date of dateRange(record.start, record.end)) cells.add(cellKey(record.employeeId, date));
  return cells;
}

export function markCreated(ops: readonly ChangeOp[], now = Date.now()): void {
  const offBefore = new Set<string>();
  const offAfter = new Set<string>();
  for (const op of ops) {
    if (op.collection === 'shifts' && op.before === null && op.after) createdAt.set(`shift:${op.id}`, now);
    if (op.collection === 'timeOff') {
      timeOffCells(op.before).forEach((key) => offBefore.add(key));
      timeOffCells(op.after).forEach((key) => offAfter.add(key));
    }
  }
  for (const key of offAfter) if (!offBefore.has(key)) createdAt.set(`off:${key}`, now);

  if (createdAt.size > 5000) {
    for (const [key, at] of createdAt) if (now - at > FRESH_FOR_MS) createdAt.delete(key);
  }
}

function isRecent(key: string, now: number): boolean {
  const at = createdAt.get(key);
  return at !== undefined && now - at < FRESH_FOR_MS;
}

/** True for shifts created moments ago. Old shifts and first loads never animate. */
export function isFreshShift(id: ID, now = Date.now()): boolean {
  return isRecent(`shift:${id}`, now);
}

/** True when this person's date became time off moments ago. */
export function isFreshTimeOff(employeeId: ID, date: ISODate, now = Date.now()): boolean {
  return isRecent(`off:${cellKey(employeeId, date)}`, now);
}

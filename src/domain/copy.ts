import type { ChangeSet } from './changeSet';
import { addDays } from './dates';
import { createId } from './ids';
import type { ID, ISODate } from './types';

/** Copying an earlier period forward, and clearing what is shown. */

export interface CopyResult {
  copied: number;
  /** Days left alone because the person has time off. */
  skipped: number;
}

/**
 * Replaces the shifts on `dates` for these people with the shifts from
 * `offsetDays` earlier. Days with time off are left as they are.
 */
export function copyFromEarlier(
  changes: ChangeSet,
  employeeIds: readonly ID[],
  dates: readonly ISODate[],
  offsetDays: number,
): CopyResult {
  const result: CopyResult = { copied: 0, skipped: 0 };
  for (const employeeId of employeeIds) {
    for (const date of dates) {
      const source = changes.shiftsAt(employeeId, addDays(date, -offsetDays));
      const target = changes.shiftsAt(employeeId, date);
      if (changes.timeOffOn(employeeId, date)) {
        if (source.length > 0) result.skipped++;
        continue;
      }
      for (const shift of target) changes.remove('shifts', shift.id);
      for (const shift of source) {
        changes.put('shifts', { ...shift, id: createId(), date });
        result.copied++;
      }
    }
  }
  return result;
}

/** Removes every shift on `dates` for these people. Returns how many. */
export function clearShifts(
  changes: ChangeSet,
  employeeIds: readonly ID[],
  dates: readonly ISODate[],
): number {
  let removed = 0;
  for (const employeeId of employeeIds) {
    for (const date of dates) {
      for (const shift of changes.shiftsAt(employeeId, date)) {
        changes.remove('shifts', shift.id);
        removed++;
      }
    }
  }
  return removed;
}

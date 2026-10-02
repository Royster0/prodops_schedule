import { compareTimes } from './shifts';
import type { Employee, Shift, TimeOff } from './types';

/** What a day lists in Month view: who works and when, then who is off. */

export type AgendaEntry = { employee: Employee; shift: Shift } | { employee: Employee; timeOff: TimeOff };

/**
 * A day's shifts ordered by start time, followed by time off. `shifts` and
 * `timeOff` are per person, in the same order as `employees`. People with the
 * same times keep that order.
 */
export function dayAgenda(
  employees: readonly Employee[],
  shifts: readonly (readonly Shift[])[],
  timeOff: readonly (TimeOff | undefined)[],
): AgendaEntry[] {
  const working = employees
    .flatMap((employee, i) => shifts[i].map((shift) => ({ employee, shift })))
    .sort((a, b) => compareTimes(a.shift, b.shift));
  const off = employees.flatMap((employee, i) => {
    const record = timeOff[i];
    return record ? [{ employee, timeOff: record }] : [];
  });
  return [...working, ...off];
}

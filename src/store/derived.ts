import { createMatcher, visibleEmployees, type Matcher } from '../domain/filters';
import { periodFor, type Period } from '../domain/period';
import {
  buildShiftCells,
  buildTimeOffCells,
  shiftsIn,
  timeOffIn,
  type ShiftCells,
  type TimeOffCells,
} from '../domain/scheduleIndex';
import { sortByOrder } from '../domain/shifts';
import type { Employee, Filters, ShiftTemplate } from '../domain/types';
import type { StoreState } from './types';

/*
 * Derived data, memoized on input identity so selectors return stable values.
 * Zustand re-renders a component only when its selected value changes, so these
 * keep unrelated changes (e.g. painting one cell) from re-rendering everything.
 */

function memoize<Args extends unknown[], R>(compute: (...args: Args) => R): (...args: Args) => R {
  let lastArgs: Args | null = null;
  let lastResult: R;
  return (...args: Args) => {
    if (lastArgs && args.length === lastArgs.length && args.every((arg, i) => arg === lastArgs![i])) {
      return lastResult;
    }
    lastArgs = args;
    lastResult = compute(...args);
    return lastResult;
  };
}

/** Returns the previous array when the new one has the same items. */
function reuseIfSame<T>(): (next: T[]) => T[] {
  let previous: T[] = [];
  return (next) => {
    if (next.length === previous.length && next.every((item, i) => item === previous[i])) return previous;
    previous = next;
    return next;
  };
}

let previousCells: ShiftCells | undefined;
const shiftCellsOf = memoize((shifts: StoreState['data']['shifts']) => {
  previousCells = buildShiftCells(shifts, previousCells);
  return previousCells;
});

const timeOffCellsOf = memoize(buildTimeOffCells);
const employeesOf = memoize((employees: StoreState['data']['employees']) =>
  sortByOrder(Object.values(employees)),
);
const templatesOf = memoize((templates: StoreState['data']['templates']) =>
  sortByOrder<ShiftTemplate>(Object.values(templates)),
);
const patternsOf = memoize((patterns: StoreState['data']['patterns']) =>
  sortByOrder(Object.values(patterns)),
);
const tagsOf = memoize((tags: StoreState['data']['tags']) =>
  Object.values(tags).sort((a, b) => a.name.localeCompare(b.name)),
);
const holidaysOf = memoize((holidays: StoreState['data']['holidays']) =>
  Object.values(holidays).sort((a, b) => a.date.localeCompare(b.date)),
);
const holidaysByDateOf = memoize(
  (holidays: StoreState['data']['holidays']) => new Map(Object.values(holidays).map((h) => [h.date, h])),
);
const periodOf = memoize(periodFor);
const matcherOf = memoize(createMatcher);

const keepVisible = reuseIfSame<Employee>();
const visibleOf = memoize(
  (
    employees: Employee[],
    filters: Filters,
    matcher: Matcher,
    period: Period,
    shifts: ShiftCells,
    off: TimeOffCells,
  ) =>
    keepVisible(
      visibleEmployees({
        employees,
        filters,
        matcher,
        dates: period.dates,
        shiftsOf: (id, date) => shiftsIn(shifts, id, date),
        timeOffOf: (id, date) => timeOffIn(off, id, date),
      }),
    ),
);

export const selectShiftCells = (s: StoreState) => shiftCellsOf(s.data.shifts);
export const selectTimeOffCells = (s: StoreState) => timeOffCellsOf(s.data.timeOff);
export const selectEmployees = (s: StoreState) => employeesOf(s.data.employees);
export const selectTemplates = (s: StoreState) => templatesOf(s.data.templates);
export const selectPatterns = (s: StoreState) => patternsOf(s.data.patterns);
export const selectTags = (s: StoreState) => tagsOf(s.data.tags);
export const selectHolidays = (s: StoreState) => holidaysOf(s.data.holidays);
export const selectHolidaysByDate = (s: StoreState) => holidaysByDateOf(s.data.holidays);
export const selectPeriod = (s: StoreState) => periodOf(s.view, s.anchor, s.data.settings.weekStart);
export const selectMatcher = (s: StoreState) => matcherOf(s.filters, s.data.templates, s.data.employees);

export const selectVisibleEmployees = (s: StoreState) =>
  visibleOf(
    selectEmployees(s),
    s.filters,
    selectMatcher(s),
    selectPeriod(s),
    selectShiftCells(s),
    selectTimeOffCells(s),
  );

const visibleIdsOf = memoize((employees: Employee[]) => employees.map((e) => e.id));
export const selectVisibleIds = (s: StoreState) => visibleIdsOf(selectVisibleEmployees(s));

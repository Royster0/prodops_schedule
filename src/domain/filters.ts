import { shiftKind, shiftTags, type TemplateLookup } from './shifts';
import type { Employee, Filters, ID, ISODate, Shift, TimeOff } from './types';

/** Which shifts, time off and people match the active filters. */

export const EMPTY_FILTERS: Filters = { search: '', people: [], tags: [], kinds: [], hideEmpty: true };

/** Number shown on the Filter button. "Hide people with no matches" is a mode, not a filter. */
export function activeFilterCount(filters: Filters): number {
  return (filters.search.trim() ? 1 : 0) + filters.people.length + filters.tags.length + filters.kinds.length;
}

export interface Matcher {
  /** True when no kind or tag filter is set, so everything matches. */
  readonly matchesAll: boolean;
  shift(shift: Shift): boolean;
  timeOff(timeOff: TimeOff): boolean;
  /** True when tag filters are set and the person has one of the tags. */
  personTags(employeeId: ID): boolean;
}

export function createMatcher(
  filters: Filters,
  templates: TemplateLookup,
  employees: Readonly<Record<ID, Employee>>,
): Matcher {
  const kinds = new Set(filters.kinds);
  const tags = new Set(filters.tags);
  const hasTags = (ids: readonly ID[]) => ids.some((id) => tags.has(id));
  const personTags = (employeeId: ID) => tags.size > 0 && hasTags(employees[employeeId]?.tags ?? []);

  return {
    matchesAll: kinds.size === 0 && tags.size === 0,
    shift(shift) {
      if (kinds.size > 0 && !kinds.has(shiftKind(shift, templates))) return false;
      if (tags.size === 0) return true;
      return hasTags(shiftTags(shift, templates)) || personTags(shift.employeeId);
    },
    timeOff(timeOff) {
      if (kinds.size > 0 && !kinds.has('off')) return false;
      if (tags.size > 0 && !personTags(timeOff.employeeId)) return false;
      return true;
    },
    personTags,
  };
}

export interface VisibilityInput {
  employees: readonly Employee[];
  filters: Filters;
  matcher: Matcher;
  /** Dates shown in the current view. */
  dates: readonly ISODate[];
  shiftsOf(employeeId: ID, date: ISODate): readonly Shift[];
  timeOffOf(employeeId: ID, date: ISODate): TimeOff | undefined;
}

/** People shown as rows, in the given order. */
export function visibleEmployees(input: VisibilityInput): Employee[] {
  const { filters, matcher, dates } = input;
  const people = new Set(filters.people);
  const search = filters.search.trim().toLowerCase();
  const narrowByMatches = filters.hideEmpty && !matcher.matchesAll;
  const tagFiltersOnly = filters.kinds.length === 0;

  return input.employees.filter((employee) => {
    if (people.size > 0 && !people.has(employee.id)) return false;
    if (search && !employee.name.toLowerCase().includes(search)) return false;
    if (!narrowByMatches) return true;
    if (tagFiltersOnly && matcher.personTags(employee.id)) return true;
    return dates.some((date) => {
      if (input.shiftsOf(employee.id, date).some(matcher.shift)) return true;
      const off = input.timeOffOf(employee.id, date);
      return off !== undefined && matcher.timeOff(off);
    });
  });
}

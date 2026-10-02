import { emptyCollections } from '../domain/changeSet';
import { DEFAULT_SETTINGS, byId } from '../domain/seed';
import type {
  Employee,
  Holiday,
  ID,
  Pattern,
  ScheduleData,
  Shift,
  ShiftTemplate,
  Tag,
  TimeOff,
} from '../domain/types';

/** Small builders for readable tests. Ids are readable strings, not UUIDs. */

export function employee(id: ID, overrides: Partial<Employee> = {}): Employee {
  return { id, name: id, color: '#2F5BD3', tags: [], order: 0, ...overrides };
}

export function template(id: ID, overrides: Partial<ShiftTemplate> = {}): ShiftTemplate {
  return {
    id,
    name: id,
    code: id.slice(0, 3),
    start: '08:00',
    end: '16:30',
    breakMins: 30,
    color: '#2F5BD3',
    tags: [],
    order: 0,
    ...overrides,
  };
}

export function shift(id: ID, employeeId: ID, date: string, overrides: Partial<Shift> = {}): Shift {
  return {
    id,
    employeeId,
    date,
    start: '08:00',
    end: '16:30',
    breakMins: 30,
    templateId: null,
    templateName: '',
    label: '',
    color: '#2F5BD3',
    tags: [],
    note: '',
    ...overrides,
  };
}

export function timeOff(
  id: ID,
  employeeId: ID,
  start: string,
  end: string,
  overrides: Partial<TimeOff> = {},
): TimeOff {
  return { id, employeeId, start, end, type: 'vacation', note: '', ...overrides };
}

export function pattern(id: ID, days: (ID | '')[], overrides: Partial<Pattern> = {}): Pattern {
  return { id, name: id, length: days.length === 14 ? 14 : 7, days, order: 0, ...overrides };
}

export function tag(id: ID, overrides: Partial<Tag> = {}): Tag {
  return { id, name: id, color: '#C8412A', ...overrides };
}

export function holiday(id: ID, date: string, name = id): Holiday {
  return { id, date, name };
}

export interface DataInput {
  employees?: Employee[];
  templates?: ShiftTemplate[];
  shifts?: Shift[];
  patterns?: Pattern[];
  tags?: Tag[];
  holidays?: Holiday[];
  timeOff?: TimeOff[];
}

export function makeData(input: DataInput = {}): ScheduleData {
  return {
    ...emptyCollections(),
    employees: byId(input.employees ?? []),
    templates: byId(input.templates ?? []),
    shifts: byId(input.shifts ?? []),
    patterns: byId(input.patterns ?? []),
    tags: byId(input.tags ?? []),
    holidays: byId(input.holidays ?? []),
    timeOff: byId(input.timeOff ?? []),
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Time off records for one person as compact 'start..end type' strings, sorted. */
export function describeTimeOff(data: ScheduleData, employeeId: ID): string[] {
  return Object.values(data.timeOff)
    .filter((t) => t.employeeId === employeeId)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((t) => `${t.start}..${t.end} ${t.type}`);
}

import type {
  ChangeOp,
  CollectionName,
  CollectionTypes,
  Employee,
  Holiday,
  Pattern,
  Settings,
  Shift,
  ShiftTemplate,
  Tag,
  TimeOff,
  TimeOffType,
} from '../domain/types';

/**
 * Maps the app's records to Supabase rows and back. Table and column names follow
 * supabase/migrations: snake_case, `order` is `sort_order`, and times come back
 * from Postgres with seconds ('07:00:00').
 */

export type Row = Record<string, unknown>;

export const TABLES: Record<CollectionName, string> = {
  employees: 'employees',
  templates: 'shift_templates',
  shifts: 'shifts',
  patterns: 'patterns',
  tags: 'tags',
  holidays: 'holidays',
  timeOff: 'time_off',
};

export const SETTINGS_TABLE = 'schedules';

export const COLLECTION_BY_TABLE: Record<string, CollectionName> = Object.fromEntries(
  Object.entries(TABLES).map(([collection, table]) => [table, collection as CollectionName]),
);

/** One op as apply_changes expects it. A null row deletes the record. */
export interface RowOp {
  table: string;
  id: string;
  row: Row | null;
}

type Mapper<T> = { toRow(record: T): Row; fromRow(row: Row): T };

const hhmm = (value: unknown) => String(value).slice(0, 5);
const str = (value: unknown) => (value == null ? '' : String(value));
const num = (value: unknown) => Number(value);
const ids = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

const employees: Mapper<Employee> = {
  toRow: (e) => ({ name: e.name, color: e.color, tag_ids: e.tags, sort_order: e.order, is_demo: !!e.demo }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    color: str(r.color),
    tags: ids(r.tag_ids),
    order: num(r.sort_order),
    ...(r.is_demo ? { demo: true } : {}),
  }),
};

const templates: Mapper<ShiftTemplate> = {
  toRow: (t) => ({
    name: t.name,
    code: t.code,
    start_time: t.start,
    end_time: t.end,
    break_mins: t.breakMins,
    color: t.color,
    tag_ids: t.tags,
    sort_order: t.order,
  }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    code: str(r.code),
    start: hhmm(r.start_time),
    end: hhmm(r.end_time),
    breakMins: num(r.break_mins),
    color: str(r.color),
    tags: ids(r.tag_ids),
    order: num(r.sort_order),
  }),
};

const shifts: Mapper<Shift> = {
  toRow: (s) => ({
    employee_id: s.employeeId,
    date: s.date,
    start_time: s.start,
    end_time: s.end,
    break_mins: s.breakMins,
    template_id: s.templateId,
    template_name: s.templateName,
    label: s.label,
    color: s.color,
    tag_ids: s.tags,
    note: s.note,
    pattern_id: s.patternId ?? null,
  }),
  fromRow: (r) => ({
    id: str(r.id),
    employeeId: str(r.employee_id),
    date: str(r.date),
    start: hhmm(r.start_time),
    end: hhmm(r.end_time),
    breakMins: num(r.break_mins),
    templateId: r.template_id == null ? null : str(r.template_id),
    templateName: str(r.template_name),
    label: str(r.label),
    color: str(r.color),
    tags: ids(r.tag_ids),
    note: str(r.note),
    ...(r.pattern_id == null ? {} : { patternId: str(r.pattern_id) }),
  }),
};

const patterns: Mapper<Pattern> = {
  toRow: (p) => ({ name: p.name, length: p.length, days: p.days, sort_order: p.order }),
  fromRow: (r) => ({
    id: str(r.id),
    name: str(r.name),
    length: num(r.length) === 14 ? 14 : 7,
    days: ids(r.days),
    order: num(r.sort_order),
  }),
};

const tags: Mapper<Tag> = {
  toRow: (t) => ({ name: t.name, color: t.color }),
  fromRow: (r) => ({ id: str(r.id), name: str(r.name), color: str(r.color) }),
};

const holidays: Mapper<Holiday> = {
  toRow: (h) => ({ date: h.date, name: h.name }),
  fromRow: (r) => ({ id: str(r.id), date: str(r.date), name: str(r.name) }),
};

const timeOff: Mapper<TimeOff> = {
  toRow: (t) => ({
    employee_id: t.employeeId,
    start_date: t.start,
    end_date: t.end,
    type: t.type,
    note: t.note,
  }),
  fromRow: (r) => ({
    id: str(r.id),
    employeeId: str(r.employee_id),
    start: str(r.start_date),
    end: str(r.end_date),
    type: str(r.type) as TimeOffType,
    note: str(r.note),
  }),
};

const MAPPERS: { [K in CollectionName]: Mapper<CollectionTypes[K]> } = {
  employees,
  templates,
  shifts,
  patterns,
  tags,
  holidays,
  timeOff,
};

export function toRow<K extends CollectionName>(collection: K, record: CollectionTypes[K]): Row {
  return MAPPERS[collection].toRow(record);
}

export function fromRow<K extends CollectionName>(collection: K, row: Row): CollectionTypes[K] {
  return MAPPERS[collection].fromRow(row);
}

export function settingsToRow(s: Settings): Row {
  return {
    title: s.title,
    week_start: s.weekStart,
    clock: s.clock,
    day_start: s.dayStart,
    day_end: s.dayEnd,
  };
}

export function settingsFromRow(r: Row): Settings {
  return {
    title: str(r.title),
    weekStart: num(r.week_start) === 0 ? 0 : 1,
    clock: num(r.clock) === 24 ? 24 : 12,
    dayStart: num(r.day_start),
    dayEnd: num(r.day_end),
  };
}

export function toRowOp(op: ChangeOp): RowOp {
  if (op.collection === 'settings') return { table: SETTINGS_TABLE, id: op.id, row: settingsToRow(op.after) };
  const row = op.after ? toRow(op.collection, op.after as CollectionTypes[typeof op.collection]) : null;
  return { table: TABLES[op.collection], id: op.id, row };
}

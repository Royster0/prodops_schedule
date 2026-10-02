import { emptyCollections } from '../domain/changeSet';
import { isHexColor } from '../domain/color';
import { isISODate } from '../domain/dates';
import { DEFAULT_SETTINGS } from '../domain/seed';
import { isHHMM } from '../domain/time';
import { TIME_OFF_TYPES } from '../domain/color';
import { COLLECTION_NAMES, type CollectionName, type ScheduleData, type Settings } from '../domain/types';

/** Versioned storage format, validation and migrations. */

export const SCHEMA_VERSION = 1;

export interface StoredSchedule {
  version: number;
  data: ScheduleData;
}

export class SchemaError extends Error {
  override name = 'SchemaError';
}

/**
 * Brings stored data from any known version up to the current one and checks
 * its shape. Throws SchemaError with a readable reason when it can't.
 */
export function migrate(raw: unknown): ScheduleData {
  if (!isObject(raw)) throw new SchemaError("This isn't a schedule file.");
  const version = raw.version;
  if (typeof version !== 'number') throw new SchemaError('The file has no version number.');
  if (version > SCHEMA_VERSION) {
    throw new SchemaError(`The file is from a newer version (${version}). Update the app and try again.`);
  }
  // Future schema versions add steps here, e.g. `if (version === 1) raw = fromV1(raw)`.
  return validateScheduleData(raw.data);
}

type Check = (value: unknown) => boolean;

const isString: Check = (v) => typeof v === 'string';
const isNumber: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const isStringArray: Check = (v) => Array.isArray(v) && v.every(isString);
const isNullableString: Check = (v) => v === null || isString(v);

const RECORD_FIELDS: Record<CollectionName, Record<string, Check>> = {
  employees: { name: isString, color: isHexColor, tags: isStringArray, order: isNumber },
  templates: {
    name: isString,
    code: isString,
    start: isHHMM,
    end: isHHMM,
    breakMins: isNumber,
    color: isHexColor,
    tags: isStringArray,
    order: isNumber,
  },
  shifts: {
    employeeId: isString,
    date: isISODate,
    start: isHHMM,
    end: isHHMM,
    breakMins: isNumber,
    templateId: isNullableString,
    templateName: isString,
    label: isString,
    color: isHexColor,
    tags: isStringArray,
    note: isString,
  },
  patterns: {
    name: isString,
    length: (v) => v === 7 || v === 14,
    days: isStringArray,
    order: isNumber,
  },
  tags: { name: isString, color: isHexColor },
  holidays: { date: isISODate, name: isString },
  timeOff: {
    employeeId: isString,
    start: isISODate,
    end: isISODate,
    type: (v) => TIME_OFF_TYPES.includes(v as never),
    note: isString,
  },
};

const COLLECTION_LABELS: Record<CollectionName, string> = {
  employees: 'person',
  templates: 'shift template',
  shifts: 'shift',
  patterns: 'pattern',
  tags: 'tag',
  holidays: 'holiday',
  timeOff: 'time off',
};

export function validateScheduleData(value: unknown): ScheduleData {
  if (!isObject(value)) throw new SchemaError('The file has no schedule data.');
  const data = { ...emptyCollections(), settings: validateSettings(value.settings) } as ScheduleData;
  for (const name of COLLECTION_NAMES) {
    const table = value[name] ?? {};
    if (!isObject(table)) throw new SchemaError(`The ${COLLECTION_LABELS[name]} list is damaged.`);
    for (const [id, record] of Object.entries(table)) {
      if (!isObject(record) || record.id !== id || !hasFields(record, RECORD_FIELDS[name])) {
        throw new SchemaError(`A ${COLLECTION_LABELS[name]} in the file is damaged (${id}).`);
      }
    }
    (data[name] as Record<string, unknown>) = table;
  }
  for (const pattern of Object.values(data.patterns)) {
    if (pattern.days.length !== pattern.length) {
      throw new SchemaError(`The pattern "${pattern.name}" has the wrong number of days.`);
    }
  }
  return data;
}

function validateSettings(value: unknown): Settings {
  if (!isObject(value)) return { ...DEFAULT_SETTINGS };
  const s = value as Partial<Settings>;
  return {
    title: typeof s.title === 'string' && s.title.trim() ? s.title : DEFAULT_SETTINGS.title,
    weekStart: s.weekStart === 0 ? 0 : 1,
    clock: s.clock === 24 ? 24 : 12,
    dayStart: isHour(s.dayStart, 0, 12) ? s.dayStart : DEFAULT_SETTINGS.dayStart,
    dayEnd: isHour(s.dayEnd, 13, 24) ? s.dayEnd : DEFAULT_SETTINGS.dayEnd,
  };
}

function isHour(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function hasFields(record: Record<string, unknown>, fields: Record<string, Check>): boolean {
  return Object.entries(fields).every(([key, check]) => check(record[key]));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

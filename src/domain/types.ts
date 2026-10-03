/** Core schedule data model. Derived values such as hours are never stored. */

export type ID = string;
/** 'YYYY-MM-DD', a local calendar date with no time zone. */
export type ISODate = string;
/** '07:30', 24-hour. */
export type HHMM = string;

export interface Employee {
  id: ID;
  name: string;
  color: string;
  tags: ID[];
  order: number;
  demo?: boolean;
}

export interface ShiftTemplate {
  id: ID;
  name: string;
  /** Up to 3 characters, e.g. 'L10'. */
  code: string;
  start: HHMM;
  end: HHMM;
  breakMins: number;
  color: string;
  tags: ID[];
  order: number;
}

export interface Shift {
  id: ID;
  employeeId: ID;
  date: ISODate;
  start: HHMM;
  end: HHMM;
  breakMins: number;
  /** null means a one-off shift. */
  templateId: ID | null;
  /** Snapshot, used if the template is later deleted. */
  templateName: string;
  /** Optional. Overrides the displayed name when not empty. */
  label: string;
  /** Snapshot for template shifts, the chosen color for one-offs. */
  color: string;
  tags: ID[];
  note: string;
  /** The work pattern that placed this shift through Apply shifts, if any. Used for filtering. */
  patternId?: ID | null;
}

export interface Pattern {
  id: ID;
  name: string;
  length: 7 | 14;
  /** Index 0 is Monday of week A. '' is a day off. */
  days: (ID | '')[];
  order: number;
}

export interface Tag {
  id: ID;
  name: string;
  color: string;
}

export interface Holiday {
  id: ID;
  date: ISODate;
  name: string;
}

export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'unavailable';

export interface TimeOff {
  id: ID;
  employeeId: ID;
  start: ISODate;
  /** Inclusive. */
  end: ISODate;
  type: TimeOffType;
  note: string;
}

export interface Settings {
  title: string;
  weekStart: 0 | 1;
  clock: 12 | 24;
  /** 0..12 */
  dayStart: number;
  /** 13..24 */
  dayEnd: number;
}

/** Everything that is stored, keyed by id for cheap lookups and change ops. */
export interface ScheduleData {
  employees: Record<ID, Employee>;
  templates: Record<ID, ShiftTemplate>;
  shifts: Record<ID, Shift>;
  patterns: Record<ID, Pattern>;
  tags: Record<ID, Tag>;
  holidays: Record<ID, Holiday>;
  timeOff: Record<ID, TimeOff>;
  settings: Settings;
}

/** Maps each keyed collection to its record type. */
export interface CollectionTypes {
  employees: Employee;
  templates: ShiftTemplate;
  shifts: Shift;
  patterns: Pattern;
  tags: Tag;
  holidays: Holiday;
  timeOff: TimeOff;
}

export type CollectionName = keyof CollectionTypes;

export const COLLECTION_NAMES: readonly CollectionName[] = [
  'employees',
  'templates',
  'shifts',
  'patterns',
  'tags',
  'holidays',
  'timeOff',
];

export const SETTINGS_ID = 'settings';

/**
 * One recorded change. `before` null means the record was created,
 * `after` null means it was deleted. Settings is a single record.
 */
export type ChangeOp =
  | {
      [K in CollectionName]: {
        collection: K;
        id: ID;
        before: CollectionTypes[K] | null;
        after: CollectionTypes[K] | null;
      };
    }[CollectionName]
  | { collection: 'settings'; id: typeof SETTINGS_ID; before: Settings; after: Settings };

export type ViewMode = 'day' | 'week' | 'twoWeeks' | 'month';

/** Brushes paint cells. Select is the non-painting tool. */
export type Brush =
  | { kind: 'template'; templateId: ID }
  | { kind: 'erase' }
  | { kind: 'timeOff'; type: TimeOffType };

export type Tool = { kind: 'select' } | Brush;

/** Shift kind for filtering: a template id, or 'custom' for one-offs. Time off is 'off'. */
export type KindFilter = ID | 'custom' | 'off';

export interface Filters {
  search: string;
  people: ID[];
  tags: ID[];
  kinds: KindFilter[];
  /** Work patterns: matches shifts placed by one of them. */
  patterns: ID[];
  hideEmpty: boolean;
}

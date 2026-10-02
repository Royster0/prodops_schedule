import { collapseOps } from './undo';
import {
  COLLECTION_NAMES,
  SETTINGS_ID,
  type ChangeOp,
  type CollectionName,
  type CollectionTypes,
  type ID,
  type ISODate,
  type ScheduleData,
  type Settings,
  type Shift,
  type TimeOff,
} from './types';

export function cellKey(employeeId: ID, date: ISODate): string {
  return `${employeeId}|${date}`;
}

/**
 * A working copy of the schedule that records every change as a ChangeOp.
 * Domain operations write through it; the store commits `ops` as one undo entry.
 *
 * Collections are copied on first write, so the original data is never mutated
 * and untouched collections keep their identity.
 */
export class ChangeSet {
  private current: ScheduleData;
  private readonly copied = new Set<CollectionName>();
  private readonly log: ChangeOp[] = [];
  private shiftCells: Map<string, Set<ID>> | null = null;

  constructor(base: ScheduleData) {
    this.current = { ...base };
  }

  get data(): ScheduleData {
    return this.current;
  }

  get settings(): Settings {
    return this.current.settings;
  }

  /** Changes so far, one op per record. */
  get ops(): ChangeOp[] {
    return collapseOps(this.log);
  }

  get<K extends CollectionName>(collection: K, id: ID): CollectionTypes[K] | undefined {
    return this.table(collection)[id];
  }

  list<K extends CollectionName>(collection: K): CollectionTypes[K][] {
    return Object.values(this.table(collection));
  }

  /** Creates or replaces a record. */
  put<K extends CollectionName>(collection: K, record: CollectionTypes[K]): void {
    const table = this.writableTable(collection);
    const before = table[record.id] ?? null;
    table[record.id] = record;
    if (collection === 'shifts') this.indexShift(before as Shift | null, record as Shift);
    this.log.push({ collection, id: record.id, before, after: record } as ChangeOp);
  }

  remove<K extends CollectionName>(collection: K, id: ID): void {
    const table = this.table(collection);
    const before = table[id];
    if (!before) return;
    delete this.writableTable(collection)[id];
    if (collection === 'shifts') this.indexShift(before as Shift, null);
    this.log.push({ collection, id, before, after: null } as ChangeOp);
  }

  setSettings(next: Settings): void {
    const before = this.current.settings;
    this.current.settings = next;
    this.log.push({ collection: 'settings', id: SETTINGS_ID, before, after: next });
  }

  /** Shifts for one person on one date. */
  shiftsAt(employeeId: ID, date: ISODate): Shift[] {
    const ids = this.cells().get(cellKey(employeeId, date));
    if (!ids) return [];
    const shifts = this.current.shifts;
    return [...ids].map((id) => shifts[id]);
  }

  timeOffFor(employeeId: ID): TimeOff[] {
    return this.list('timeOff').filter((t) => t.employeeId === employeeId);
  }

  /** Time off covering one person's date, if any. Ranges never overlap. */
  timeOffOn(employeeId: ID, date: ISODate): TimeOff | undefined {
    return this.list('timeOff').find((t) => t.employeeId === employeeId && t.start <= date && date <= t.end);
  }

  private table<K extends CollectionName>(collection: K): Record<ID, CollectionTypes[K]> {
    return this.current[collection] as Record<ID, CollectionTypes[K]>;
  }

  private writableTable<K extends CollectionName>(collection: K): Record<ID, CollectionTypes[K]> {
    if (!this.copied.has(collection)) {
      this.copied.add(collection);
      (this.current[collection] as Record<ID, CollectionTypes[K]>) = { ...this.table(collection) };
    }
    return this.table(collection);
  }

  private cells(): Map<string, Set<ID>> {
    if (!this.shiftCells) {
      this.shiftCells = new Map();
      for (const shift of Object.values(this.current.shifts)) this.indexShift(null, shift);
    }
    return this.shiftCells;
  }

  private indexShift(before: Shift | null, after: Shift | null): void {
    if (!this.shiftCells) return;
    if (before) this.shiftCells.get(cellKey(before.employeeId, before.date))?.delete(before.id);
    if (after) {
      const key = cellKey(after.employeeId, after.date);
      let ids = this.shiftCells.get(key);
      if (!ids) this.shiftCells.set(key, (ids = new Set()));
      ids.add(after.id);
    }
  }
}

/** Applies each op's `after` value. Returns new data and leaves the input untouched. */
export function applyOps(data: ScheduleData, ops: readonly ChangeOp[]): ScheduleData {
  const next: ScheduleData = { ...data };
  const copied = new Set<CollectionName>();
  for (const op of ops) {
    if (op.collection === 'settings') {
      next.settings = op.after;
      continue;
    }
    const collection = op.collection;
    if (!copied.has(collection)) {
      copied.add(collection);
      (next[collection] as Record<ID, unknown>) = { ...next[collection] };
    }
    const table = next[collection] as Record<ID, unknown>;
    if (op.after) table[op.id] = op.after;
    else delete table[op.id];
  }
  return next;
}

export function emptyCollections(): Omit<ScheduleData, 'settings'> {
  return Object.fromEntries(COLLECTION_NAMES.map((name) => [name, {}])) as Omit<ScheduleData, 'settings'>;
}

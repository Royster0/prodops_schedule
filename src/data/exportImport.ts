import type { ChangeSet } from '../domain/changeSet';
import { count, joinList } from '../domain/format';
import { COLLECTION_NAMES, type ISODate, type ScheduleData } from '../domain/types';
import { SCHEMA_VERSION, SchemaError, migrate, type StoredSchedule } from './schema';

/** Export to a JSON file, and import one back after checking it. */

export function exportFileName(date: ISODate): string {
  return `team-schedule-${date}.json`;
}

export function serializeSchedule(data: ScheduleData): string {
  const file: StoredSchedule = { version: SCHEMA_VERSION, data };
  return JSON.stringify(file, null, 2);
}

/** Parses and validates an exported file. Throws SchemaError with a readable reason. */
export function parseScheduleFile(text: string): ScheduleData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SchemaError("This file isn't valid JSON. Pick a file exported from Team schedule.");
  }
  return migrate(raw);
}

/** "5 people, 120 shifts, 5 shift templates, …" */
export function describeCounts(data: ScheduleData): string {
  const n = (record: object) => Object.keys(record).length;
  return joinList([
    count(n(data.employees), 'person', 'people'),
    count(n(data.shifts), 'shift'),
    count(n(data.templates), 'shift template'),
    count(n(data.patterns), 'pattern'),
    count(n(data.tags), 'tag'),
    count(n(data.holidays), 'holiday'),
    count(n(data.timeOff), 'time off range', 'time off ranges'),
  ]);
}

/** Replaces everything with `next`, recorded as ops so it can be undone. */
export function replaceAll(changes: ChangeSet, next: ScheduleData): void {
  for (const name of COLLECTION_NAMES) {
    const incoming = next[name] as Record<string, never>;
    for (const record of changes.list(name)) if (!incoming[record.id]) changes.remove(name, record.id);
    for (const record of Object.values(incoming)) changes.put(name, record);
  }
  changes.setSettings(next.settings);
}

/** Starts a browser download of the schedule. */
export function downloadSchedule(data: ScheduleData, date: ISODate): void {
  const blob = new Blob([serializeSchedule(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(date);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

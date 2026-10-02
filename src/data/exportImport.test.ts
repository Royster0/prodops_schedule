import { describe, expect, it } from 'vitest';
import { ChangeSet } from '../domain/changeSet';
import { addDemoTeam } from '../domain/demo';
import { createStarterData } from '../domain/seed';
import { employee, makeData } from '../testing/fixtures';
import {
  describeCounts,
  exportFileName,
  parseScheduleFile,
  replaceAll,
  serializeSchedule,
} from './exportImport';

describe('export and import', () => {
  const changes = new ChangeSet(createStarterData());
  addDemoTeam(changes, '2026-10-02');
  const data = changes.data;

  it('names the file by date', () => {
    expect(exportFileName('2026-10-02')).toBe('team-schedule-2026-10-02.json');
  });

  it('restores exactly the same data', () => {
    expect(parseScheduleFile(serializeSchedule(data))).toEqual(data);
  });

  it('explains files it cannot read', () => {
    expect(() => parseScheduleFile('not json')).toThrow(/isn't valid JSON/);
    expect(() => parseScheduleFile('{"hello":1}')).toThrow(/no version/);
    expect(() => parseScheduleFile('{"version":9,"data":{}}')).toThrow(/newer version/);
  });

  it('counts what is in a file', () => {
    expect(describeCounts(data)).toBe(
      '5 people, 46 shifts, 5 shift templates, 4 patterns, 3 tags, 0 holidays and 1 time off range',
    );
  });

  it('replaces everything as undoable ops', () => {
    const current = new ChangeSet(makeData({ employees: [employee('old')] }));
    replaceAll(current, data);
    expect(current.data.employees).toEqual(data.employees);
    expect(current.data.shifts).toEqual(data.shifts);
    expect(
      current.ops.some((op) => op.collection === 'employees' && op.id === 'old' && op.after === null),
    ).toBe(true);
  });
});

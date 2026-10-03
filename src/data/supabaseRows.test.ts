import { describe, expect, it } from 'vitest';
import { employee, holiday, pattern, shift, tag, template, timeOff } from '../testing/fixtures';
import type { CollectionName, CollectionTypes } from '../domain/types';
import { fromRow, settingsFromRow, settingsToRow, toRow, toRowOp } from './supabaseRows';

/** What Postgres hands back: the row plus its key, with times in HH:MM:SS. */
function roundTrip<K extends CollectionName>(collection: K, record: CollectionTypes[K]) {
  const row = toRow(collection, record);
  for (const key of ['start_time', 'end_time']) if (typeof row[key] === 'string') row[key] += ':00';
  return fromRow(collection, { ...row, id: record.id, schedule_id: 'sched-1', updated_by: 'tab' });
}

describe('Supabase rows', () => {
  it('round-trips every kind of record', () => {
    expect(roundTrip('employees', employee('ana', { tags: ['t1'], order: 3 }))).toEqual(
      employee('ana', { tags: ['t1'], order: 3 }),
    );
    expect(roundTrip('employees', employee('demo', { demo: true }))).toEqual(
      employee('demo', { demo: true }),
    );
    expect(roundTrip('templates', template('day', { start: '07:00', end: '17:30' }))).toEqual(
      template('day', { start: '07:00', end: '17:30' }),
    );
    expect(roundTrip('shifts', shift('s1', 'ana', '2026-10-01'))).toEqual(shift('s1', 'ana', '2026-10-01'));
    expect(
      roundTrip('shifts', shift('s2', 'ana', '2026-10-01', { templateId: 'day', patternId: 'p1' })),
    ).toEqual(shift('s2', 'ana', '2026-10-01', { templateId: 'day', patternId: 'p1' }));
    expect(roundTrip('patterns', pattern('p1', ['day', '', '', '', '', '', '']))).toEqual(
      pattern('p1', ['day', '', '', '', '', '', '']),
    );
    expect(roundTrip('tags', tag('t1'))).toEqual(tag('t1'));
    expect(roundTrip('holidays', holiday('h1', '2026-12-25', 'Christmas'))).toEqual(
      holiday('h1', '2026-12-25', 'Christmas'),
    );
    expect(roundTrip('timeOff', timeOff('o1', 'ana', '2026-10-01', '2026-10-03', { type: 'sick' }))).toEqual(
      timeOff('o1', 'ana', '2026-10-01', '2026-10-03', { type: 'sick' }),
    );
  });

  it('round-trips settings', () => {
    const settings = { title: 'Ops', weekStart: 0 as const, clock: 24 as const, dayStart: 6, dayEnd: 22 };
    expect(settingsFromRow(settingsToRow(settings))).toEqual(settings);
  });

  it('turns ops into apply_changes rows, with null for deletes', () => {
    const ana = employee('ana');
    expect(toRowOp({ collection: 'employees', id: 'ana', before: null, after: ana })).toMatchObject({
      table: 'employees',
      id: 'ana',
      row: { name: 'ana', sort_order: 0 },
    });
    expect(
      toRowOp({ collection: 'timeOff', id: 'o1', before: timeOff('o1', 'ana', 'a', 'b'), after: null }),
    ).toEqual({ table: 'time_off', id: 'o1', row: null });
  });
});

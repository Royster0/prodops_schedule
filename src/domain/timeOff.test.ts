import { describe, expect, it } from 'vitest';
import { describeTimeOff, employee, makeData, shift, timeOff } from '../testing/fixtures';
import { ChangeSet } from './changeSet';
import { addDay, addRange, removeDays, subtractRange } from './timeOff';

const week = timeOff('t1', 'ana', '2026-10-05', '2026-10-09');

describe('subtractRange', () => {
  it('trims the start or the end', () => {
    expect(subtractRange(week, '2026-10-05', '2026-10-06')).toEqual([{ ...week, start: '2026-10-07' }]);
    expect(subtractRange(week, '2026-10-08', '2026-10-12')).toEqual([{ ...week, end: '2026-10-07' }]);
  });

  it('splits in two when the removed days are in the middle', () => {
    const parts = subtractRange(week, '2026-10-07', '2026-10-07');
    expect(parts.map((p) => `${p.start}..${p.end}`)).toEqual([
      '2026-10-05..2026-10-06',
      '2026-10-08..2026-10-09',
    ]);
    expect(parts[0].id).toBe('t1');
    expect(parts[1].id).not.toBe('t1');
  });

  it('removes everything or nothing', () => {
    expect(subtractRange(week, '2026-10-01', '2026-10-31')).toEqual([]);
    expect(subtractRange(week, '2026-10-10', '2026-10-12')).toEqual([week]);
  });
});

describe('removeDays', () => {
  it('records a split as one update and one create', () => {
    const changes = new ChangeSet(makeData({ timeOff: [week] }));
    removeDays(changes, week, '2026-10-07', '2026-10-07');
    expect(describeTimeOff(changes.data, 'ana')).toEqual([
      '2026-10-05..2026-10-06 vacation',
      '2026-10-08..2026-10-09 vacation',
    ]);
    expect(changes.ops).toHaveLength(2);
  });

  it('deletes a record when nothing is left', () => {
    const single = timeOff('t2', 'ana', '2026-10-05', '2026-10-05');
    const changes = new ChangeSet(makeData({ timeOff: [single] }));
    removeDays(changes, single, '2026-10-05', '2026-10-05');
    expect(changes.data.timeOff).toEqual({});
  });
});

describe('addDay', () => {
  it('creates a single-day record', () => {
    const changes = new ChangeSet(makeData());
    addDay(changes, 'ana', '2026-10-05', 'sick');
    expect(describeTimeOff(changes.data, 'ana')).toEqual(['2026-10-05..2026-10-05 sick']);
  });

  it('extends the record ending the day before, or starting the day after', () => {
    const changes = new ChangeSet(makeData({ timeOff: [week] }));
    addDay(changes, 'ana', '2026-10-10', 'vacation');
    addDay(changes, 'ana', '2026-10-04', 'vacation');
    expect(describeTimeOff(changes.data, 'ana')).toEqual(['2026-10-04..2026-10-10 vacation']);
  });

  it('joins two records into one', () => {
    const changes = new ChangeSet(
      makeData({
        timeOff: [
          timeOff('a', 'ana', '2026-10-05', '2026-10-06'),
          timeOff('b', 'ana', '2026-10-08', '2026-10-09'),
        ],
      }),
    );
    addDay(changes, 'ana', '2026-10-07', 'vacation');
    expect(describeTimeOff(changes.data, 'ana')).toEqual(['2026-10-05..2026-10-09 vacation']);
  });

  it('does nothing when the day is already that type', () => {
    const changes = new ChangeSet(makeData({ timeOff: [week] }));
    addDay(changes, 'ana', '2026-10-07', 'vacation');
    expect(changes.ops).toEqual([]);
  });

  it('replaces a different type on that day', () => {
    const changes = new ChangeSet(makeData({ timeOff: [week] }));
    addDay(changes, 'ana', '2026-10-07', 'sick');
    expect(describeTimeOff(changes.data, 'ana')).toEqual([
      '2026-10-05..2026-10-06 vacation',
      '2026-10-07..2026-10-07 sick',
      '2026-10-08..2026-10-09 vacation',
    ]);
  });

  it('only merges with the same person and type', () => {
    const changes = new ChangeSet(
      makeData({
        timeOff: [
          timeOff('a', 'ana', '2026-10-05', '2026-10-06', { type: 'sick' }),
          timeOff('b', 'ben', '2026-10-08', '2026-10-09'),
        ],
      }),
    );
    addDay(changes, 'ana', '2026-10-07', 'vacation');
    expect(describeTimeOff(changes.data, 'ana')).toEqual([
      '2026-10-05..2026-10-06 sick',
      '2026-10-07..2026-10-07 vacation',
    ]);
  });
});

describe('addRange', () => {
  it('trims overlapping ranges and removes shifts in the range by default', () => {
    const changes = new ChangeSet(
      makeData({
        employees: [employee('ana')],
        timeOff: [week],
        shifts: [shift('s1', 'ana', '2026-10-12'), shift('s2', 'ana', '2026-10-14')],
      }),
    );
    const removed = addRange(
      changes,
      { employeeId: 'ana', start: '2026-10-08', end: '2026-10-12', type: 'personal', note: '' },
      true,
    );
    expect(removed).toBe(1);
    expect(describeTimeOff(changes.data, 'ana')).toEqual([
      '2026-10-05..2026-10-07 vacation',
      '2026-10-08..2026-10-12 personal',
    ]);
    expect(Object.keys(changes.data.shifts)).toEqual(['s2']);
  });

  it('keeps shifts when asked', () => {
    const changes = new ChangeSet(makeData({ shifts: [shift('s1', 'ana', '2026-10-12')] }));
    addRange(
      changes,
      { employeeId: 'ana', start: '2026-10-12', end: '2026-10-12', type: 'sick', note: '' },
      false,
    );
    expect(Object.keys(changes.data.shifts)).toEqual(['s1']);
  });
});

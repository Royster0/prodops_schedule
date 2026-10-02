import { describe, expect, it } from 'vitest';
import { employee, makeData, shift, timeOff } from '../testing/fixtures';
import { ChangeSet, applyOps } from './changeSet';

describe('ChangeSet', () => {
  it('records creates, updates and deletes without touching the original', () => {
    const data = makeData({ employees: [employee('ana')], shifts: [shift('s1', 'ana', '2026-10-01')] });
    const changes = new ChangeSet(data);

    changes.put('employees', employee('ben'));
    changes.put('shifts', { ...data.shifts.s1, note: 'Keys' });
    changes.remove('employees', 'ana');

    expect(Object.keys(data.employees)).toEqual(['ana']);
    expect(data.shifts.s1.note).toBe('');
    expect(Object.keys(changes.data.employees)).toEqual(['ben']);
    expect(changes.ops.map((op) => `${op.collection}:${op.id}:${!!op.before}->${!!op.after}`)).toEqual([
      'employees:ben:false->true',
      'shifts:s1:true->true',
      'employees:ana:true->false',
    ]);
  });

  it('keeps untouched collections identical', () => {
    const data = makeData({ employees: [employee('ana')] });
    const changes = new ChangeSet(data);
    changes.put('shifts', shift('s1', 'ana', '2026-10-01'));
    expect(changes.data.employees).toBe(data.employees);
    expect(changes.data.shifts).not.toBe(data.shifts);
  });

  it('collapses several writes to one record and drops create-then-delete', () => {
    const changes = new ChangeSet(makeData());
    changes.put('shifts', shift('s1', 'ana', '2026-10-01'));
    changes.put('shifts', shift('s1', 'ana', '2026-10-01', { note: 'later' }));
    changes.put('shifts', shift('s2', 'ana', '2026-10-02'));
    changes.remove('shifts', 's2');
    expect(changes.ops).toHaveLength(1);
    expect(changes.ops[0]).toMatchObject({ before: null, after: { note: 'later' } });
  });

  it('looks up shifts per cell and keeps the lookup current', () => {
    const changes = new ChangeSet(makeData({ shifts: [shift('s1', 'ana', '2026-10-01')] }));
    expect(changes.shiftsAt('ana', '2026-10-01').map((s) => s.id)).toEqual(['s1']);
    changes.put('shifts', shift('s2', 'ana', '2026-10-01'));
    changes.put('shifts', { ...changes.get('shifts', 's1')!, date: '2026-10-02' });
    expect(changes.shiftsAt('ana', '2026-10-01').map((s) => s.id)).toEqual(['s2']);
    expect(changes.shiftsAt('ana', '2026-10-02').map((s) => s.id)).toEqual(['s1']);
    changes.remove('shifts', 's2');
    expect(changes.shiftsAt('ana', '2026-10-01')).toEqual([]);
  });

  it('finds time off covering a date', () => {
    const changes = new ChangeSet(makeData({ timeOff: [timeOff('t1', 'ana', '2026-10-05', '2026-10-09')] }));
    expect(changes.timeOffOn('ana', '2026-10-07')?.id).toBe('t1');
    expect(changes.timeOffOn('ana', '2026-10-10')).toBeUndefined();
    expect(changes.timeOffOn('ben', '2026-10-07')).toBeUndefined();
  });

  it('records settings changes', () => {
    const changes = new ChangeSet(makeData());
    changes.setSettings({ ...changes.settings, clock: 24 });
    expect(changes.ops).toEqual([
      expect.objectContaining({ collection: 'settings', after: expect.objectContaining({ clock: 24 }) }),
    ]);
  });
});

describe('applyOps', () => {
  it('replays ops onto data', () => {
    const base = makeData({ employees: [employee('ana')] });
    const changes = new ChangeSet(base);
    changes.put('employees', employee('ben'));
    changes.remove('employees', 'ana');
    const replayed = applyOps(base, changes.ops);
    expect(replayed.employees).toEqual(changes.data.employees);
    expect(base.employees.ana).toBeDefined();
  });
});

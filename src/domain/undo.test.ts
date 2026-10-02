import { describe, expect, it } from 'vitest';
import { employee, makeData, shift } from '../testing/fixtures';
import { ChangeSet, applyOps } from './changeSet';
import { UNDO_LIMIT, invertOps, pushUndo } from './undo';

describe('undo', () => {
  it('restores the data exactly by replaying before values in reverse', () => {
    const base = makeData({ employees: [employee('ana')], shifts: [shift('s1', 'ana', '2026-10-01')] });
    const changes = new ChangeSet(base);
    changes.remove('shifts', 's1');
    changes.put('shifts', shift('s2', 'ana', '2026-10-01'));
    changes.put('employees', { ...base.employees.ana, name: 'Ana R' });

    const after = changes.data;
    const undone = applyOps(after, invertOps(changes.ops));
    expect(undone.shifts).toEqual(base.shifts);
    expect(undone.employees).toEqual(base.employees);
  });

  it('keeps only the last 60 entries and ignores empty ones', () => {
    let stack = pushUndo([], { label: 'empty', ops: [] });
    expect(stack).toHaveLength(0);
    const op = { collection: 'employees', id: 'a', before: null, after: employee('a') } as const;
    for (let i = 0; i < UNDO_LIMIT + 5; i++) stack = pushUndo(stack, { label: `step ${i}`, ops: [op] });
    expect(stack).toHaveLength(60);
    expect(stack[0].label).toBe('step 5');
    expect(stack[59].label).toBe(`step ${UNDO_LIMIT + 4}`);
  });
});

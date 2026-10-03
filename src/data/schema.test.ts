import { describe, expect, it } from 'vitest';
import { createStarterData } from '../domain/seed';
import { employee, makeData, shift } from '../testing/fixtures';
import { SchemaError, migrate } from './schema';

describe('migrate', () => {
  it('accepts current data', () => {
    const data = makeData({ employees: [employee('ana')], shifts: [shift('s1', 'ana', '2026-10-01')] });
    expect(migrate({ version: 1, data })).toEqual(data);
  });

  it('accepts starter data', () => {
    const data = createStarterData();
    expect(migrate({ version: 1, data })).toEqual(data);
  });

  it('rejects files without a version, newer versions and damaged records', () => {
    expect(() => migrate({ data: makeData() })).toThrow(SchemaError);
    expect(() => migrate({ version: 2, data: makeData() })).toThrow(/newer version/);
    const broken = makeData({ shifts: [{ ...shift('s1', 'ana', '2026-10-01'), start: '7am' }] });
    expect(() => migrate({ version: 1, data: broken })).toThrow(/shift in the file is damaged/);
    expect(() => migrate('hello')).toThrow(/isn't a schedule file/);
  });

  it('fills missing collections and repairs settings', () => {
    const data = migrate({ version: 1, data: { settings: { title: '', dayStart: 30 } } });
    expect(data.shifts).toEqual({});
    expect(data.settings).toEqual({
      title: 'Team schedule',
      weekStart: 1,
      clock: 12,
      dayStart: 5,
      dayEnd: 23,
    });
  });
});

describe('pattern links on shifts', () => {
  it('loads shifts saved before pattern links existed, and ones with a link', () => {
    const old = makeData({ shifts: [shift('s1', 'ana', '2026-10-01')] });
    delete (old.shifts.s1 as { patternId?: unknown }).patternId;
    expect(() => migrate({ version: 1, data: old })).not.toThrow();
    const linked = makeData({ shifts: [shift('s2', 'ana', '2026-10-01', { patternId: 'p1' })] });
    expect(migrate({ version: 1, data: linked }).shifts.s2.patternId).toBe('p1');
  });
});

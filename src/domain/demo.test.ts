import { describe, expect, it } from 'vitest';
import { ChangeSet } from './changeSet';
import { mondayIndex } from './dates';
import { addDemoTeam, removeDemoTeam } from './demo';
import { createStarterData } from './seed';

describe('demo team', () => {
  const changes = new ChangeSet(createStarterData());
  addDemoTeam(changes, '2026-10-02');
  const people = changes.list('employees').sort((a, b) => a.order - b.order);
  const byName = (name: string) => people.find((p) => p.name === name)!;
  const shiftsOf = (name: string) => changes.list('shifts').filter((s) => s.employeeId === byName(name).id);

  it('adds five demo people with this week and next scheduled', () => {
    expect(people.map((p) => p.name)).toEqual([
      'Ana Ruiz',
      'Ben Okafor',
      'Chloe Park',
      'Dev Patel',
      'Emma Lund',
    ]);
    expect(people.every((p) => p.demo)).toBe(true);
    expect(shiftsOf('Ben Okafor')).toHaveLength(8);
    expect(
      shiftsOf('Emma Lund')
        .map((s) => mondayIndex(s.date))
        .sort(),
    ).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('gives Dev this Friday as vacation instead of a shift', () => {
    const dev = byName('Dev Patel');
    expect(shiftsOf('Dev Patel')).toHaveLength(9);
    expect(changes.timeOffFor(dev.id)).toMatchObject([
      { start: '2026-10-02', end: '2026-10-02', type: 'vacation' },
    ]);
  });

  it('adds the Saturday inventory count and tags', () => {
    const inventory = changes.list('shifts').find((s) => s.label === 'Inventory count')!;
    expect(inventory).toMatchObject({ date: '2026-10-03', start: '08:00', end: '12:00', templateId: null });
    const lead = changes.list('tags').find((t) => t.name === 'Lead')!;
    expect(byName('Ana Ruiz').tags).toEqual([lead.id]);
  });

  it('can be removed with everything they had', () => {
    const removed = new ChangeSet(changes.data);
    expect(removeDemoTeam(removed)).toBe(5);
    expect(removed.list('shifts')).toEqual([]);
    expect(removed.list('timeOff')).toEqual([]);
  });
});

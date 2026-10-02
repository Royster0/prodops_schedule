import { describe, expect, it } from 'vitest';
import { employee, makeData, pattern, shift, tag, template, timeOff } from '../testing/fixtures';
import { ChangeSet } from './changeSet';
import {
  addPeople,
  deleteEmployee,
  deleteTag,
  deleteTemplate,
  moveInOrder,
  parseNames,
  saveTemplate,
  templateTimesChanged,
} from './manage';
import { shiftColor, shiftName } from './shifts';

describe('people', () => {
  it('parses one name per line', () => {
    expect(parseNames('  Ana Ruiz \n\nBen   Okafor\r\n  ')).toEqual(['Ana Ruiz', 'Ben Okafor']);
  });

  it('adds people at the end with distinct colors', () => {
    const changes = new ChangeSet(makeData({ employees: [employee('x', { order: 4 })] }));
    const added = addPeople(changes, ['Ana', 'Ben']);
    expect(added.map((e) => e.order)).toEqual([5, 6]);
    expect(added[0].color).not.toBe(added[1].color);
  });

  it('removes shifts and time off with the person', () => {
    const changes = new ChangeSet(
      makeData({
        employees: [employee('ana'), employee('ben')],
        shifts: [shift('a1', 'ana', '2026-10-01'), shift('b1', 'ben', '2026-10-01')],
        timeOff: [timeOff('t', 'ana', '2026-10-05', '2026-10-06')],
      }),
    );
    deleteEmployee(changes, 'ana');
    expect(Object.keys(changes.data.employees)).toEqual(['ben']);
    expect(Object.keys(changes.data.shifts)).toEqual(['b1']);
    expect(changes.data.timeOff).toEqual({});
  });

  it('reorders with up and down', () => {
    const changes = new ChangeSet(
      makeData({
        employees: [employee('a', { order: 0 }), employee('b', { order: 1 }), employee('c', { order: 2 })],
      }),
    );
    moveInOrder(changes, 'employees', 'c', -1);
    const order = changes
      .list('employees')
      .sort((x, y) => x.order - y.order)
      .map((e) => e.id);
    expect(order).toEqual(['a', 'c', 'b']);
    moveInOrder(changes, 'employees', 'a', -1);
    expect(changes.ops).toHaveLength(2);
  });
});

describe('tags', () => {
  it('removes a deleted tag from people, templates and shifts', () => {
    const changes = new ChangeSet(
      makeData({
        tags: [tag('lead'), tag('keep')],
        employees: [employee('ana', { tags: ['lead', 'keep'] })],
        templates: [template('D8', { tags: ['lead'] })],
        shifts: [shift('s', 'ana', '2026-10-01', { tags: ['lead'] })],
      }),
    );
    deleteTag(changes, 'lead');
    expect(changes.get('employees', 'ana')?.tags).toEqual(['keep']);
    expect(changes.get('templates', 'D8')?.tags).toEqual([]);
    expect(changes.get('shifts', 's')?.tags).toEqual([]);
  });
});

describe('templates', () => {
  const longDay = template('L10', { name: 'Long day', start: '07:00', end: '17:30', color: '#0E7C6B' });

  it('leaves placed shifts as they are and frees pattern days', () => {
    const placed = shift('s', 'ana', '2026-10-01', {
      templateId: 'L10',
      templateName: 'Long day',
      color: '#0E7C6B',
    });
    const changes = new ChangeSet(
      makeData({
        templates: [longDay],
        shifts: [placed],
        patterns: [pattern('p', ['L10', '', '', '', '', '', ''])],
      }),
    );
    deleteTemplate(changes, 'L10');
    const kept = changes.get('shifts', 's')!;
    expect(kept).toBe(placed);
    expect(shiftName(kept, changes.data.templates)).toBe('Long day');
    expect(shiftColor(kept, changes.data.templates)).toBe('#0E7C6B');
    expect(changes.get('patterns', 'p')?.days[0]).toBe('');
  });

  it('updates upcoming shifts only when asked', () => {
    const past = shift('past', 'ana', '2026-09-30', { templateId: 'L10', start: '07:00', end: '17:30' });
    const upcoming = shift('next', 'ana', '2026-10-02', { templateId: 'L10', start: '07:00', end: '17:30' });
    const edited = { ...longDay, start: '06:30', end: '17:00' };
    expect(templateTimesChanged(longDay, edited)).toBe(true);

    const changes = new ChangeSet(makeData({ templates: [longDay], shifts: [past, upcoming] }));
    expect(saveTemplate(changes, edited, '2026-10-02')).toBe(1);
    expect(changes.get('shifts', 'next')).toMatchObject({ start: '06:30', end: '17:00' });
    expect(changes.get('shifts', 'past')).toBe(past);

    const untouched = new ChangeSet(makeData({ templates: [longDay], shifts: [past, upcoming] }));
    saveTemplate(untouched, edited, null);
    expect(untouched.get('shifts', 'next')).toBe(upcoming);
  });
});

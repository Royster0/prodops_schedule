import { describe, expect, it } from 'vitest';
import { describeTimeOff, makeData, shift, template, timeOff } from '../testing/fixtures';
import { ChangeSet } from './changeSet';
import { dateTargets, paintCell, paintTargets, sameTool } from './painting';
import type { Brush } from './types';

const longDay = template('L10', { name: 'Long day', start: '07:00', end: '17:30', color: '#0E7C6B' });
const day = template('D8', { name: 'Day' });
const paintLong: Brush = { kind: 'template', templateId: 'L10' };
const erase: Brush = { kind: 'erase' };

function setup(input: Parameters<typeof makeData>[0] = {}) {
  return new ChangeSet(makeData({ templates: [longDay, day], ...input }));
}

describe('template brush', () => {
  it('creates a shift from the template', () => {
    const changes = setup();
    expect(paintCell(changes, paintLong, 'ana', '2026-10-05')).toBe('painted');
    const [created] = changes.shiftsAt('ana', '2026-10-05');
    expect(created).toMatchObject({
      templateId: 'L10',
      templateName: 'Long day',
      start: '07:00',
      end: '17:30',
      color: '#0E7C6B',
      label: '',
    });
  });

  it('skips days with time off', () => {
    const changes = setup({ timeOff: [timeOff('t', 'ana', '2026-10-05', '2026-10-05')] });
    expect(paintCell(changes, paintLong, 'ana', '2026-10-05')).toBe('skipped');
    expect(changes.ops).toEqual([]);
  });

  it('leaves an identical untouched shift alone', () => {
    const existing = shift('s1', 'ana', '2026-10-05', { templateId: 'L10', start: '07:00', end: '17:30' });
    const changes = setup({ shifts: [existing] });
    expect(paintCell(changes, paintLong, 'ana', '2026-10-05')).toBe('unchanged');
    expect(changes.ops).toEqual([]);
  });

  it('replaces every shift in the cell, including edited or labeled template shifts', () => {
    const labeled = shift('s1', 'ana', '2026-10-05', {
      templateId: 'L10',
      start: '07:00',
      end: '17:30',
      label: 'Cover',
    });
    const other = shift('s2', 'ana', '2026-10-05', { templateId: 'D8' });
    const changes = setup({ shifts: [labeled, other] });
    expect(paintCell(changes, paintLong, 'ana', '2026-10-05')).toBe('painted');
    const cell = changes.shiftsAt('ana', '2026-10-05');
    expect(cell).toHaveLength(1);
    expect(cell[0].id).not.toBe('s1');
    expect(cell[0].label).toBe('');
  });
});

describe('erase brush', () => {
  it('removes shifts first and leaves time off alone', () => {
    const changes = setup({
      shifts: [shift('s1', 'ana', '2026-10-05'), shift('s2', 'ana', '2026-10-05')],
      timeOff: [timeOff('t', 'ana', '2026-10-05', '2026-10-05')],
    });
    paintCell(changes, erase, 'ana', '2026-10-05');
    expect(changes.shiftsAt('ana', '2026-10-05')).toEqual([]);
    expect(describeTimeOff(changes.data, 'ana')).toEqual(['2026-10-05..2026-10-05 vacation']);
  });

  it('then removes just that day of time off, splitting the range', () => {
    const changes = setup({ timeOff: [timeOff('t', 'ana', '2026-10-05', '2026-10-09')] });
    paintCell(changes, erase, 'ana', '2026-10-07');
    expect(describeTimeOff(changes.data, 'ana')).toEqual([
      '2026-10-05..2026-10-06 vacation',
      '2026-10-08..2026-10-09 vacation',
    ]);
  });

  it('does nothing on an empty cell', () => {
    const changes = setup();
    expect(paintCell(changes, erase, 'ana', '2026-10-07')).toBe('unchanged');
  });
});

describe('time off brush', () => {
  it('removes shifts and adds the day', () => {
    const changes = setup({ shifts: [shift('s1', 'ana', '2026-10-05')] });
    paintCell(changes, { kind: 'timeOff', type: 'sick' }, 'ana', '2026-10-05');
    expect(changes.shiftsAt('ana', '2026-10-05')).toEqual([]);
    expect(describeTimeOff(changes.data, 'ana')).toEqual(['2026-10-05..2026-10-05 sick']);
  });

  it('merges neighboring days of the same type into one record', () => {
    const changes = setup();
    const vacation: Brush = { kind: 'timeOff', type: 'vacation' };
    for (const date of ['2026-10-05', '2026-10-06', '2026-10-07']) paintCell(changes, vacation, 'ana', date);
    expect(describeTimeOff(changes.data, 'ana')).toEqual(['2026-10-05..2026-10-07 vacation']);
    expect(changes.ops.filter((op) => op.collection === 'timeOff')).toHaveLength(1);
  });
});

describe('targets', () => {
  const visible = ['ana', 'ben', 'cy', 'dee'];

  it('paints only the person when they are not part of a multi-selection', () => {
    expect(paintTargets('ana', new Set(), visible)).toEqual(['ana']);
    expect(paintTargets('ana', new Set(['ana']), visible)).toEqual(['ana']);
    expect(paintTargets('ana', new Set(['ben', 'cy']), visible)).toEqual(['ana']);
  });

  it('fans out to every selected person who is shown', () => {
    expect(paintTargets('ben', new Set(['ben', 'dee', 'hidden']), visible)).toEqual(['ben', 'dee']);
  });

  it('fills a date for the selection, or everyone shown', () => {
    expect(dateTargets(new Set(['cy']), visible)).toEqual(['cy']);
    expect(dateTargets(new Set(), visible)).toEqual(visible);
    expect(dateTargets(new Set(['hidden']), visible)).toEqual(visible);
  });
});

describe('sameTool', () => {
  it('compares brushes by what they paint', () => {
    expect(sameTool({ kind: 'template', templateId: 'a' }, { kind: 'template', templateId: 'a' })).toBe(true);
    expect(sameTool({ kind: 'template', templateId: 'a' }, { kind: 'template', templateId: 'b' })).toBe(
      false,
    );
    expect(sameTool({ kind: 'timeOff', type: 'sick' }, { kind: 'timeOff', type: 'sick' })).toBe(true);
    expect(sameTool({ kind: 'erase' }, { kind: 'select' })).toBe(false);
  });
});

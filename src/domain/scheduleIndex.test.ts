import { describe, expect, it } from 'vitest';
import { shift, timeOff } from '../testing/fixtures';
import { byId } from './seed';
import {
  buildShiftCells,
  buildTimeOffCells,
  dayShifts,
  rowShifts,
  rowTimeOff,
  shiftsIn,
} from './scheduleIndex';

describe('schedule index', () => {
  const a = shift('a', 'ana', '2026-10-05', { start: '14:00' });
  const b = shift('b', 'ana', '2026-10-05', { start: '06:00' });
  const c = shift('c', 'ben', '2026-10-06');

  it('groups shifts per cell sorted by start time', () => {
    const cells = buildShiftCells(byId([a, b, c]));
    expect(shiftsIn(cells, 'ana', '2026-10-05').map((s) => s.id)).toEqual(['b', 'a']);
    expect(shiftsIn(cells, 'ana', '2026-10-06')).toEqual([]);
  });

  it('reuses arrays for cells that did not change', () => {
    const first = buildShiftCells(byId([a, b, c]));
    const d = shift('d', 'ben', '2026-10-07');
    const second = buildShiftCells(byId([a, b, c, d]), first);
    expect(shiftsIn(second, 'ana', '2026-10-05')).toBe(shiftsIn(first, 'ana', '2026-10-05'));
    expect(shiftsIn(second, 'ben', '2026-10-07')).not.toBe(shiftsIn(first, 'ben', '2026-10-07'));
  });

  it('keeps row and day slices stable until one of their cells changes', () => {
    const dates = ['2026-10-05', '2026-10-06', '2026-10-07'];
    const first = buildShiftCells(byId([a, b, c]));
    const second = buildShiftCells(byId([a, b, c, shift('d', 'ben', '2026-10-07')]), first);
    expect(rowShifts(second, 'ana', dates)).toBe(rowShifts(first, 'ana', dates));
    expect(rowShifts(second, 'ben', dates)).not.toBe(rowShifts(first, 'ben', dates));
    expect(dayShifts(second, ['ana', 'ben'], '2026-10-05')).toBe(
      dayShifts(first, ['ana', 'ben'], '2026-10-05'),
    );
    expect(dayShifts(second, ['ana', 'ben'], '2026-10-07')).not.toBe(
      dayShifts(first, ['ana', 'ben'], '2026-10-07'),
    );
  });

  it('expands time off ranges into cells', () => {
    const cells = buildTimeOffCells(byId([timeOff('t', 'ana', '2026-10-05', '2026-10-06')]));
    expect(rowTimeOff(cells, 'ana', ['2026-10-04', '2026-10-05', '2026-10-06']).map((t) => t?.id)).toEqual([
      undefined,
      't',
      't',
    ]);
  });
});

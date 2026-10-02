import type { MouseEvent } from 'react';
import type { ID, ISODate } from '../domain/types';
import { selectVisibleIds } from '../store/derived';
import { scheduleStore } from '../store/useScheduleStore';

/*
 * Click handling shared by every view. Handlers are module-level so cells can
 * stay memoized: they read what they need from data attributes and the store.
 *
 * Cells carry data-cell, data-employee-id and data-date. Blocks inside carry
 * data-shift-id or data-time-off-id; an empty spot can carry data-start.
 * Month days carry data-day-cell and data-date: they paint for the selected people.
 */

export function cellOf(element: Element | null): { employeeId: ID; date: ISODate } | null {
  const cell = element?.closest<HTMLElement>('[data-cell]');
  const employeeId = cell?.dataset.employeeId;
  const date = cell?.dataset.date;
  return employeeId && date ? { employeeId, date } : null;
}

export function dayOf(element: Element | null): ISODate | null {
  return element?.closest<HTMLElement>('[data-day-cell]')?.dataset.date ?? null;
}

/**
 * Tap on the empty part of a Month day. Adds a shift for the selected person on
 * that date, or applies shifts for several selected people. With a brush, a
 * keyboard press paints the day for the selection (pointer strokes already did).
 */
export function handleMonthDayAdd(event: MouseEvent<HTMLElement>, date: ISODate): void {
  const state = scheduleStore.getState();
  if (state.tool.kind !== 'select') {
    if (event.detail === 0) {
      state.beginStroke(state.tool);
      state.strokeDay(date);
      state.endStroke();
    }
    return;
  }
  const selected = selectVisibleIds(state).filter((id) => state.selectedIds.has(id));
  if (selected.length > 1)
    state.openSheet({ kind: 'apply', preset: { who: 'selected', from: date, to: date } });
  else state.openSheet({ kind: 'shift', employeeId: selected[0], date });
}

/** Click on a block or an empty cell. Opens an editor in Select mode. */
export function handleCellClick(event: MouseEvent<HTMLElement>): void {
  const target = event.currentTarget;
  const cell = cellOf(target);
  if (!cell) return;
  const state = scheduleStore.getState();

  if (state.tool.kind !== 'select') {
    // Pointer strokes already painted this cell. A keyboard "click" paints it here.
    if (event.detail === 0) {
      state.beginStroke(state.tool);
      state.strokeCell(cell.employeeId, cell.date);
      state.endStroke();
    }
    return;
  }

  const { shiftId, timeOffId, start } = target.dataset;
  if (shiftId) state.openSheet({ kind: 'shift', shiftId });
  else if (timeOffId) state.openSheet({ kind: 'timeOff', timeOffId });
  else state.openSheet({ kind: 'shift', employeeId: cell.employeeId, date: cell.date, start });
}

/** Click on a date header: fills the day with the active brush, or opens Day view. */
export function handleDateClick(date: ISODate): void {
  const state = scheduleStore.getState();
  if (state.tool.kind === 'select') state.openDay(date);
  else state.paintDate(date);
}

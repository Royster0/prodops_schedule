import type { ChangeSet } from './changeSet';
import { TIME_OFF_LABELS } from './color';
import { count } from './format';
import { isPlainTemplateShift, shiftFromTemplate } from './shifts';
import { addDay, removeDays } from './timeOff';
import type { Brush, ID, ISODate, ShiftTemplate, Tool } from './types';

/** What painting one cell did. */
export type PaintOutcome = 'painted' | 'unchanged' | 'skipped';

/**
 * Paints one (person, date) cell with a brush.
 * - Template: replaces the cell's shifts with one from the template. Skips days
 *   with time off, and leaves an identical untouched shift alone.
 * - Erase: removes the cell's shifts, or when there are none, that day of time off.
 * - Time off: removes the cell's shifts and marks the day, merging with neighbors.
 */
export function paintCell(changes: ChangeSet, brush: Brush, employeeId: ID, date: ISODate): PaintOutcome {
  const shifts = changes.shiftsAt(employeeId, date);

  switch (brush.kind) {
    case 'template': {
      const template = changes.get('templates', brush.templateId);
      if (!template) return 'unchanged';
      if (changes.timeOffOn(employeeId, date)) return 'skipped';
      if (shifts.length === 1 && isPlainTemplateShift(shifts[0], template)) return 'unchanged';
      for (const shift of shifts) changes.remove('shifts', shift.id);
      changes.put('shifts', shiftFromTemplate(template, employeeId, date));
      return 'painted';
    }
    case 'erase': {
      if (shifts.length > 0) {
        for (const shift of shifts) changes.remove('shifts', shift.id);
        return 'painted';
      }
      const off = changes.timeOffOn(employeeId, date);
      if (!off) return 'unchanged';
      removeDays(changes, off, date, date);
      return 'painted';
    }
    case 'timeOff': {
      for (const shift of shifts) changes.remove('shifts', shift.id);
      const existing = changes.timeOffOn(employeeId, date);
      addDay(changes, employeeId, date, brush.type);
      return shifts.length > 0 || existing?.type !== brush.type ? 'painted' : 'unchanged';
    }
  }
}

/**
 * Who a stroke on `employeeId` paints. When that person is part of a
 * multi-person selection, it fans out to every selected person who is shown.
 */
export function paintTargets(employeeId: ID, selected: ReadonlySet<ID>, visible: readonly ID[]): ID[] {
  if (!selected.has(employeeId) || selected.size < 2) return [employeeId];
  return visible.filter((id) => selected.has(id));
}

/** Who tapping a date header paints: the selection if any, otherwise everyone shown. */
export function dateTargets(selected: ReadonlySet<ID>, visible: readonly ID[]): ID[] {
  const chosen = visible.filter((id) => selected.has(id));
  return chosen.length > 0 ? chosen : [...visible];
}

/** Undo label for a stroke, e.g. "paint Long day". */
export function brushLabel(brush: Brush, templates: Readonly<Record<ID, ShiftTemplate>>): string {
  switch (brush.kind) {
    case 'template':
      return `paint ${templates[brush.templateId]?.name ?? 'shift'}`;
    case 'erase':
      return 'erase';
    case 'timeOff':
      return `paint ${TIME_OFF_LABELS[brush.type].toLowerCase()}`;
  }
}

export function skippedTimeOffMessage(skipped: number): string {
  return `Skipped ${count(skipped, 'day')} with time off. Erase the time off first to schedule them.`;
}

/** True when both are the same tool, e.g. the same template brush. */
export function sameTool(a: Tool, b: Tool): boolean {
  switch (a.kind) {
    case 'template':
      return b.kind === 'template' && a.templateId === b.templateId;
    case 'timeOff':
      return b.kind === 'timeOff' && a.type === b.type;
    default:
      return a.kind === b.kind;
  }
}

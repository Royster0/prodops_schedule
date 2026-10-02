import { createId } from './ids';
import { shiftHours, spanMinutes, toMinutes } from './time';
import type { HHMM, ID, ISODate, KindFilter, Shift, ShiftTemplate } from './types';

/** Display rules and constructors for shifts. */

export type TemplateLookup = Readonly<Record<ID, ShiftTemplate>>;

/** The linked template, if it still exists. */
export function linkedTemplate(shift: Shift, templates: TemplateLookup): ShiftTemplate | undefined {
  return shift.templateId ? templates[shift.templateId] : undefined;
}

/** A non-empty label wins, then the live template name, then the snapshot. */
export function shiftName(shift: Shift, templates: TemplateLookup): string {
  if (shift.label.trim()) return shift.label.trim();
  const template = linkedTemplate(shift, templates);
  if (template) return template.name;
  return shift.templateName || 'Shift';
}

/** Short name for compact blocks: the template code, or the start of the name. */
export function shiftCode(shift: Shift, templates: TemplateLookup): string {
  if (shift.label.trim()) return shift.label.trim().slice(0, 3);
  const template = linkedTemplate(shift, templates);
  if (template) return template.code;
  return (shift.templateName || 'Shift').slice(0, 3);
}

export function shiftColor(shift: Shift, templates: TemplateLookup): string {
  return linkedTemplate(shift, templates)?.color ?? shift.color;
}

/** The shift's own tags plus its template's tags, without duplicates. */
export function shiftTags(shift: Shift, templates: TemplateLookup): ID[] {
  const template = linkedTemplate(shift, templates);
  if (!template || template.tags.length === 0) return shift.tags;
  return [...new Set([...shift.tags, ...template.tags])];
}

/** For filters: the template id, or 'custom' for one-offs and orphaned shifts. */
export function shiftKind(shift: Shift, templates: TemplateLookup): KindFilter {
  return linkedTemplate(shift, templates) ? shift.templateId! : 'custom';
}

export function hoursOf(shift: Pick<Shift, 'start' | 'end' | 'breakMins'>): number {
  return shiftHours(shift.start, shift.end, shift.breakMins);
}

export function shiftFromTemplate(template: ShiftTemplate, employeeId: ID, date: ISODate): Shift {
  return {
    id: createId(),
    employeeId,
    date,
    start: template.start,
    end: template.end,
    breakMins: template.breakMins,
    templateId: template.id,
    templateName: template.name,
    label: '',
    color: template.color,
    tags: [],
    note: '',
  };
}

export interface CustomShiftInput {
  start: HHMM;
  end: HHMM;
  breakMins: number;
  label: string;
  color: string;
  tags?: ID[];
  note?: string;
}

export function customShift(input: CustomShiftInput, employeeId: ID, date: ISODate): Shift {
  return {
    id: createId(),
    employeeId,
    date,
    start: input.start,
    end: input.end,
    breakMins: input.breakMins,
    templateId: null,
    templateName: '',
    label: input.label,
    color: input.color,
    tags: input.tags ?? [],
    note: input.note ?? '',
  };
}

/** True when the shift is exactly this template, untouched. Painting it again is a no-op. */
export function isPlainTemplateShift(shift: Shift, template: ShiftTemplate): boolean {
  return (
    shift.templateId === template.id &&
    shift.start === template.start &&
    shift.end === template.end &&
    shift.breakMins === template.breakMins &&
    shift.label.trim() === ''
  );
}

/** Minutes relative to the shift's own date: [start, end). End may pass 1440. */
export function shiftInterval(shift: Pick<Shift, 'start' | 'end'>): [number, number] {
  const start = toMinutes(shift.start);
  return [start, start + spanMinutes(shift.start, shift.end)];
}

/** Sorts shifts in a cell by start time, then by name for stability. */
/** Earlier start first; for the same start, the one that ends sooner (overnight ends count as next day). */
export function compareTimes(a: Pick<Shift, 'start' | 'end'>, b: Pick<Shift, 'start' | 'end'>): number {
  const [aStart, aEnd] = shiftInterval(a);
  const [bStart, bEnd] = shiftInterval(b);
  return aStart - bStart || aEnd - bEnd;
}

/** compareTimes, then id, so the order is the same on every render. */
export function byStartTime(a: Shift, b: Shift): number {
  return compareTimes(a, b) || a.id.localeCompare(b.id);
}

export function sortByOrder<T extends { order: number; name?: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || (a.name ?? '').localeCompare(b.name ?? ''));
}

export function nextOrder(items: readonly { order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
}

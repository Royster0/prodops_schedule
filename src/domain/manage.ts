import type { ChangeSet } from './changeSet';
import { PALETTE } from './color';
import { createId } from './ids';
import { nextOrder, sortByOrder } from './shifts';
import type { CollectionTypes, Employee, ID, ISODate, ShiftTemplate } from './types';

/** Managing people, tags and templates, and the clean-up each change needs. */

/** One name per line, trimmed, blanks dropped. */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

/** Adds people at the end of the order, cycling through the palette. */
export function addPeople(changes: ChangeSet, names: readonly string[]): Employee[] {
  const existing = changes.list('employees');
  let order = nextOrder(existing);
  return names.map((name, i) => {
    const employee: Employee = {
      id: createId(),
      name,
      color: PALETTE[(existing.length + i) % PALETTE.length],
      tags: [],
      order: order++,
    };
    changes.put('employees', employee);
    return employee;
  });
}

/** Deleting a person removes their shifts and time off too. */
export function deleteEmployee(changes: ChangeSet, id: ID): void {
  changes.remove('employees', id);
  for (const shift of changes.list('shifts')) if (shift.employeeId === id) changes.remove('shifts', shift.id);
  for (const off of changes.timeOffFor(id)) changes.remove('timeOff', off.id);
}

/** Moves an item one place up (-1) or down (+1), renumbering the order to 0..n-1. */
export function moveInOrder<K extends 'employees' | 'templates' | 'patterns'>(
  changes: ChangeSet,
  collection: K,
  id: ID,
  direction: -1 | 1,
): void {
  const items: CollectionTypes[K][] = sortByOrder(changes.list(collection));
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  items.forEach((item, order) => {
    if (item.order !== order) changes.put(collection, { ...item, order });
  });
}

/** Deleting a tag removes it from people, templates and shifts. */
export function deleteTag(changes: ChangeSet, id: ID): void {
  changes.remove('tags', id);
  for (const employee of changes.list('employees')) {
    if (employee.tags.includes(id))
      changes.put('employees', { ...employee, tags: employee.tags.filter((t) => t !== id) });
  }
  for (const template of changes.list('templates')) {
    if (template.tags.includes(id))
      changes.put('templates', { ...template, tags: template.tags.filter((t) => t !== id) });
  }
  for (const shift of changes.list('shifts')) {
    if (shift.tags.includes(id))
      changes.put('shifts', { ...shift, tags: shift.tags.filter((t) => t !== id) });
  }
}

/**
 * Deleting a template leaves placed shifts as they are: they keep their
 * snapshot name and color. Pattern days that used it become days off.
 */
export function deleteTemplate(changes: ChangeSet, id: ID): void {
  changes.remove('templates', id);
  for (const pattern of changes.list('patterns')) {
    if (pattern.days.includes(id)) {
      changes.put('patterns', { ...pattern, days: pattern.days.map((day) => (day === id ? '' : day)) });
    }
  }
}

export function templateTimesChanged(before: ShiftTemplate, after: ShiftTemplate): boolean {
  return before.start !== after.start || before.end !== after.end || before.breakMins !== after.breakMins;
}

/**
 * Saves a template. When asked, shifts from `today` onward that use it get the
 * new times, break and snapshot. Returns how many shifts were updated.
 */
export function saveTemplate(
  changes: ChangeSet,
  template: ShiftTemplate,
  updateUpcomingFrom: ISODate | null,
): number {
  changes.put('templates', template);
  if (!updateUpcomingFrom) return 0;
  let updated = 0;
  for (const shift of changes.list('shifts')) {
    if (shift.templateId !== template.id || shift.date < updateUpcomingFrom) continue;
    changes.put('shifts', {
      ...shift,
      start: template.start,
      end: template.end,
      breakMins: template.breakMins,
      templateName: template.name,
      color: template.color,
    });
    updated++;
  }
  return updated;
}

/** Shifts on or after `from` linked to a template. */
export function upcomingShiftCount(changes: ChangeSet, templateId: ID, from: ISODate): number {
  return changes.list('shifts').filter((s) => s.templateId === templateId && s.date >= from).length;
}

export function newTemplateDraft(changes: ChangeSet): ShiftTemplate {
  const templates = changes.list('templates');
  return {
    id: createId(),
    name: '',
    code: '',
    start: '09:00',
    end: '17:30',
    breakMins: 30,
    color: PALETTE[templates.length % PALETTE.length],
    tags: [],
    order: nextOrder(templates),
  };
}

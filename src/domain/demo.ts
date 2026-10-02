import type { ChangeSet } from './changeSet';
import { addDays, mondayIndex, startOfWeek } from './dates';
import { createId } from './ids';
import { STARTER_TEMPLATES, createTemplate } from './seed';
import { customShift, nextOrder, shiftFromTemplate } from './shifts';
import { addDay } from './timeOff';
import type { ID, ISODate, ShiftTemplate } from './types';

/** The demo team offered on the empty state. Everyone is marked `demo: true`. */

interface DemoPerson {
  name: string;
  color: string;
  code: string;
  /** Monday-based weekday indexes they work. */
  weekdays: number[];
  tag?: string;
}

const DEMO_PEOPLE: readonly DemoPerson[] = [
  { name: 'Ana Ruiz', color: '#C2386C', code: 'D8', weekdays: [0, 1, 2, 3, 4], tag: 'Lead' },
  { name: 'Ben Okafor', color: '#1677A8', code: 'L10', weekdays: [0, 1, 2, 3] },
  { name: 'Chloe Park', color: '#4F7A28', code: 'L10', weekdays: [1, 2, 3, 4], tag: 'On call' },
  { name: 'Dev Patel', color: '#7B3FA0', code: 'E8', weekdays: [0, 1, 2, 3, 4], tag: 'Training' },
  { name: 'Emma Lund', color: '#4D5F70', code: 'LT', weekdays: [1, 2, 3, 4, 5] },
];

const FRIDAY = 4;
const SATURDAY = 5;

/** Finds a template by code, recreating the starter one if it was deleted. */
function templateFor(changes: ChangeSet, code: string): ShiftTemplate {
  const existing = changes.list('templates').find((t) => t.code === code);
  if (existing) return existing;
  const seed = STARTER_TEMPLATES.find((t) => t.code === code)!;
  const template = createTemplate(seed, nextOrder(changes.list('templates')));
  changes.put('templates', template);
  return template;
}

function tagId(changes: ChangeSet, name: string | undefined): ID[] {
  const tag = name ? changes.list('tags').find((t) => t.name === name) : undefined;
  return tag ? [tag.id] : [];
}

/**
 * Adds five people with this week and next scheduled. Dev has this Friday as
 * vacation, and Ana has a one-off "Inventory count" on Saturday.
 */
export function addDemoTeam(changes: ChangeSet, today: ISODate): void {
  const firstDay = startOfWeek(today, changes.settings.weekStart);
  const dates = Array.from({ length: 14 }, (_, i) => addDays(firstDay, i));
  const thisFriday = dates.find((d, i) => i < 7 && mondayIndex(d) === FRIDAY)!;
  const thisSaturday = dates.find((d, i) => i < 7 && mondayIndex(d) === SATURDAY)!;
  let order = nextOrder(changes.list('employees'));

  const ids: ID[] = [];
  for (const person of DEMO_PEOPLE) {
    const id = createId();
    ids.push(id);
    changes.put('employees', {
      id,
      name: person.name,
      color: person.color,
      tags: tagId(changes, person.tag),
      order: order++,
      demo: true,
    });
    const template = templateFor(changes, person.code);
    for (const date of dates) {
      if (!person.weekdays.includes(mondayIndex(date))) continue;
      if (person.name === 'Dev Patel' && date === thisFriday) continue;
      changes.put('shifts', shiftFromTemplate(template, id, date));
    }
  }

  const [ana, , , dev] = ids;
  addDay(changes, dev, thisFriday, 'vacation');
  changes.put(
    'shifts',
    customShift(
      { start: '08:00', end: '12:00', breakMins: 0, label: 'Inventory count', color: '#7FD1B9' },
      ana,
      thisSaturday,
    ),
  );
}

/** Removes everyone marked as demo, with their shifts and time off. */
export function removeDemoTeam(changes: ChangeSet): number {
  const demo = changes.list('employees').filter((e) => e.demo);
  for (const employee of demo) {
    changes.remove('employees', employee.id);
    for (const shift of changes.list('shifts'))
      if (shift.employeeId === employee.id) changes.remove('shifts', shift.id);
    for (const off of changes.timeOffFor(employee.id)) changes.remove('timeOff', off.id);
  }
  return demo.length;
}

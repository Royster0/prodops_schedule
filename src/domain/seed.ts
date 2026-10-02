import { emptyCollections } from './changeSet';
import { createId } from './ids';
import type { ID, Pattern, ScheduleData, Settings, ShiftTemplate, Tag } from './types';

/** Starter data seeded on first run. People are never seeded. */

export const DEFAULT_SETTINGS: Settings = {
  title: 'Team schedule',
  weekStart: 1,
  clock: 12,
  dayStart: 5,
  dayEnd: 23,
};

type TemplateSeed = Omit<ShiftTemplate, 'id' | 'order' | 'tags'>;

export const STARTER_TEMPLATES: readonly TemplateSeed[] = [
  { name: 'Day', code: 'D8', start: '08:00', end: '16:30', breakMins: 30, color: '#2F5BD3' },
  { name: 'Long day', code: 'L10', start: '07:00', end: '17:30', breakMins: 30, color: '#0E7C6B' },
  { name: 'Early', code: 'E8', start: '06:00', end: '14:30', breakMins: 30, color: '#F2B517' },
  { name: 'Late', code: 'LT', start: '14:00', end: '22:30', breakMins: 30, color: '#7B3FA0' },
  { name: 'Half day', code: 'H4', start: '08:00', end: '12:00', breakMins: 0, color: '#D9B77A' },
];

export const STARTER_TAGS: readonly Omit<Tag, 'id'>[] = [
  { name: 'Lead', color: '#C8412A' },
  { name: 'Training', color: '#1677A8' },
  { name: 'On call', color: '#4F7A28' },
];

export function createTemplate(seed: TemplateSeed, order: number): ShiftTemplate {
  return { id: createId(), ...seed, tags: [], order };
}

/** Builds the starter patterns from the Day and Long day template ids. */
export function starterPatterns(dayId: ID, longDayId: ID): Pattern[] {
  const D = dayId;
  const L = longDayId;
  const off = '';
  const monToThu = [L, L, L, L, off, off, off];
  const tueToFri = [off, L, L, L, L, off, off];
  const seeds: { name: string; days: (ID | '')[] }[] = [
    { name: '5×8, Mon to Fri', days: [D, D, D, D, D, off, off] },
    { name: '4×10, Mon to Thu', days: monToThu },
    { name: '4×10, Tue to Fri', days: tueToFri },
    { name: '4×10, alternating Mon and Fri off', days: [...monToThu, ...tueToFri] },
  ];
  return seeds.map((p, order) => ({
    id: createId(),
    name: p.name,
    length: p.days.length === 14 ? 14 : 7,
    days: p.days,
    order,
  }));
}

export function createStarterData(): ScheduleData {
  const templates = STARTER_TEMPLATES.map(createTemplate);
  const [day, longDay] = templates;
  const patterns = starterPatterns(day.id, longDay.id);
  const tags = STARTER_TAGS.map((t) => ({ id: createId(), ...t }));
  return {
    ...emptyCollections(),
    templates: byId(templates),
    patterns: byId(patterns),
    tags: byId(tags),
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function byId<T extends { id: ID }>(items: readonly T[]): Record<ID, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

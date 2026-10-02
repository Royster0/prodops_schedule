import { describe, expect, it } from 'vitest';
import { employee, makeData, shift, template, timeOff } from '../testing/fixtures';
import { EMPTY_FILTERS, activeFilterCount, createMatcher, visibleEmployees } from './filters';
import type { Filters } from './types';

const data = makeData({
  employees: [
    employee('ana', { name: 'Ana Ruiz', tags: ['lead'] }),
    employee('ben', { name: 'Ben Okafor' }),
    employee('cy', { name: 'Cy Park' }),
    employee('dee', { name: 'Dee Lund', tags: ['lead'] }),
  ],
  templates: [template('L10', { name: 'Long day' }), template('D8', { name: 'Day', tags: ['oncall'] })],
  shifts: [
    shift('a', 'ana', '2026-10-05', { templateId: 'D8' }),
    shift('b', 'ben', '2026-10-05', { templateId: 'L10' }),
    shift('c', 'cy', '2026-10-06', { templateId: null, tags: ['training'] }),
  ],
  timeOff: [timeOff('t', 'cy', '2026-10-07', '2026-10-07')],
});
const dates = ['2026-10-05', '2026-10-06', '2026-10-07'];

function visible(patch: Partial<Filters>) {
  const filters = { ...EMPTY_FILTERS, ...patch };
  const matcher = createMatcher(filters, data.templates, data.employees);
  return visibleEmployees({
    employees: Object.values(data.employees),
    filters,
    matcher,
    dates,
    shiftsOf: (id, date) => Object.values(data.shifts).filter((s) => s.employeeId === id && s.date === date),
    timeOffOf: (id, date) =>
      Object.values(data.timeOff).find((t) => t.employeeId === id && t.start <= date && date <= t.end),
  }).map((e) => e.id);
}

describe('matcher', () => {
  it('matches shift kinds: template ids and one-offs', () => {
    const m = createMatcher({ ...EMPTY_FILTERS, kinds: ['L10', 'custom'] }, data.templates, data.employees);
    expect(m.shift(data.shifts.a)).toBe(false);
    expect(m.shift(data.shifts.b)).toBe(true);
    expect(m.shift(data.shifts.c)).toBe(true);
    expect(m.timeOff(data.timeOff.t)).toBe(false);
  });

  it('treats shifts of a deleted template as one-offs', () => {
    const m = createMatcher({ ...EMPTY_FILTERS, kinds: ['custom'] }, {}, data.employees);
    expect(m.shift(data.shifts.b)).toBe(true);
  });

  it('matches tags on the shift, its template or its person', () => {
    const byTag = (tags: string[]) =>
      createMatcher({ ...EMPTY_FILTERS, tags }, data.templates, data.employees);
    expect(byTag(['training']).shift(data.shifts.c)).toBe(true);
    expect(byTag(['oncall']).shift(data.shifts.a)).toBe(true);
    expect(byTag(['lead']).shift(data.shifts.a)).toBe(true);
    expect(byTag(['lead']).shift(data.shifts.b)).toBe(false);
  });

  it('matches time off when "off" is a kind and by person tags', () => {
    expect(
      createMatcher({ ...EMPTY_FILTERS, kinds: ['off'] }, data.templates, data.employees).timeOff(
        data.timeOff.t,
      ),
    ).toBe(true);
    expect(
      createMatcher({ ...EMPTY_FILTERS, tags: ['lead'] }, data.templates, data.employees).timeOff(
        data.timeOff.t,
      ),
    ).toBe(false);
  });
});

describe('visible rows', () => {
  it('shows everyone without filters', () => {
    expect(visible({})).toEqual(['ana', 'ben', 'cy', 'dee']);
  });

  it('filters by people and search', () => {
    expect(visible({ people: ['ben', 'cy'] })).toEqual(['ben', 'cy']);
    expect(visible({ search: 'PARK' })).toEqual(['cy']);
  });

  it('hides people with no matches when filtering by Long day', () => {
    expect(visible({ kinds: ['L10'] })).toEqual(['ben']);
    expect(visible({ kinds: ['L10'], hideEmpty: false })).toEqual(['ana', 'ben', 'cy', 'dee']);
  });

  it('keeps people with a matching tag when only tags are filtered', () => {
    expect(visible({ tags: ['lead'] })).toEqual(['ana', 'dee']);
    expect(visible({ tags: ['lead'], kinds: ['L10'] })).toEqual([]);
  });

  it('counts time off as a match for the "off" kind', () => {
    expect(visible({ kinds: ['off'] })).toEqual(['cy']);
  });

  it('counts active filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, search: 'a', kinds: ['L10', 'off'], tags: ['x'] })).toBe(4);
  });
});

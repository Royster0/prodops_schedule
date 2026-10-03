import { describe, expect, it } from 'vitest';
import { employee, holiday, makeData, pattern, shift, template, timeOff } from '../testing/fixtures';
import {
  WEEKDAYS_MON_TO_FRI,
  appliedMessage,
  applyButtonLabel,
  applyShifts,
  describeApply,
  planApply,
  type ApplyRequest,
} from './apply';
import { ChangeSet } from './changeSet';
import { mondayIndex } from './dates';

const L = 'L10';
const data = makeData({
  employees: [employee('ana', { name: 'Ana Ruiz' }), employee('ben', { name: 'Ben Okafor' })],
  templates: [
    template(L, { name: 'Long day', start: '07:00', end: '17:30' }),
    template('D8', { name: 'Day', start: '08:00', end: '16:30' }),
  ],
  patterns: [
    pattern('alt', [L, L, L, L, '', '', '', '', L, L, L, L, '', ''], {
      name: '4×10, alternating Mon and Fri off',
    }),
    pattern('monThu', [L, L, L, L, '', '', ''], { name: '4×10, Mon to Thu' }),
  ],
});

function request(overrides: Partial<ApplyRequest> = {}): ApplyRequest {
  return {
    what: { kind: 'template', templateId: L },
    employeeIds: ['ana'],
    from: '2026-10-05',
    to: '2026-10-11',
    weekdays: WEEKDAYS_MON_TO_FRI,
    conflict: 'replace',
    skipHolidays: true,
    ...overrides,
  };
}

const days = (changes: ChangeSet, employeeId: string) =>
  changes
    .list('shifts')
    .filter((s) => s.employeeId === employeeId)
    .map((s) => s.date)
    .sort();

describe('applyShifts', () => {
  it('creates a template shift on each chosen weekday', () => {
    const changes = new ChangeSet(data);
    const result = applyShifts(changes, request({ employeeIds: ['ana', 'ben'] }));
    expect(result.created).toBe(10);
    expect(days(changes, 'ana')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });

  it('applies the alternating 4×10 over 4 weeks: Mon to Thu in weeks 1 and 3, Tue to Fri in weeks 2 and 4', () => {
    const changes = new ChangeSet(data);
    const result = applyShifts(
      changes,
      request({ what: { kind: 'pattern', patternId: 'alt' }, to: '2026-11-01' }),
    );
    expect(result.created).toBe(16);
    const weekdays = days(changes, 'ana').map(mondayIndex);
    expect(weekdays).toEqual([0, 1, 2, 3, 1, 2, 3, 4, 0, 1, 2, 3, 1, 2, 3, 4]);
  });

  it('starts week A at the Monday-based week containing the start date', () => {
    const changes = new ChangeSet(data);
    // Starting Wednesday Oct 14: that week is A, so Wed and Thu are worked, then Tue to Fri.
    applyShifts(
      changes,
      request({ what: { kind: 'pattern', patternId: 'alt' }, from: '2026-10-14', to: '2026-10-25' }),
    );
    expect(days(changes, 'ana')).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ]);
  });

  it('with "Keep it" leaves existing shifts untouched', () => {
    const existing = shift('s1', 'ana', '2026-10-06', { templateId: 'D8', start: '08:00', end: '16:30' });
    const changes = new ChangeSet({ ...data, shifts: { s1: existing } });
    const result = applyShifts(changes, request({ conflict: 'keep' }));
    expect(result).toMatchObject({ created: 4, kept: 1, replaced: 0 });
    expect(changes.get('shifts', 's1')).toBe(existing);
  });

  it('with "Replace it" swaps existing shifts for the new one', () => {
    const changes = new ChangeSet({ ...data, shifts: { s1: shift('s1', 'ana', '2026-10-06') } });
    const result = applyShifts(changes, request());
    expect(result).toMatchObject({ created: 5, replaced: 1 });
    expect(changes.get('shifts', 's1')).toBeUndefined();
  });

  it('clears pattern days off when replacing, but not when keeping', () => {
    const friday = shift('fri', 'ana', '2026-10-09');
    const pat = request({ what: { kind: 'pattern', patternId: 'monThu' } });

    const replacing = new ChangeSet({ ...data, shifts: { fri: friday } });
    expect(applyShifts(replacing, pat).cleared).toBe(1);
    expect(replacing.get('shifts', 'fri')).toBeUndefined();

    const keeping = new ChangeSet({ ...data, shifts: { fri: friday } });
    applyShifts(keeping, { ...pat, conflict: 'keep' });
    expect(keeping.get('shifts', 'fri')).toBe(friday);
  });

  it('leaves holidays empty when skipping them', () => {
    const withHoliday = { ...data, holidays: { h: holiday('h', '2026-10-07', 'Founders Day') } };
    const skipping = new ChangeSet(withHoliday);
    const result = applyShifts(skipping, request({ employeeIds: ['ana', 'ben'] }));
    expect(result.skippedHolidays).toBe(1);
    expect(skipping.shiftsAt('ana', '2026-10-07')).toEqual([]);
    expect(skipping.shiftsAt('ben', '2026-10-07')).toEqual([]);

    const notSkipping = new ChangeSet(withHoliday);
    applyShifts(notSkipping, request({ skipHolidays: false }));
    expect(notSkipping.shiftsAt('ana', '2026-10-07')).toHaveLength(1);
  });

  it('skips and counts days with time off', () => {
    const changes = new ChangeSet({
      ...data,
      timeOff: { t: timeOff('t', 'ana', '2026-10-08', '2026-10-09') },
    });
    const result = applyShifts(changes, request());
    expect(result).toMatchObject({ created: 3, skippedTimeOff: 2 });
  });

  it('creates custom one-off shifts', () => {
    const changes = new ChangeSet(data);
    applyShifts(
      changes,
      request({
        what: {
          kind: 'custom',
          start: '22:00',
          end: '06:00',
          breakMins: 0,
          label: 'Night',
          color: '#4D5F70',
        },
        weekdays: [5],
      }),
    );
    expect(changes.list('shifts')).toMatchObject([{ date: '2026-10-10', label: 'Night', templateId: null }]);
  });

  it('adds one time off range per person and removes their shifts', () => {
    const changes = new ChangeSet({ ...data, shifts: { s1: shift('s1', 'ben', '2026-10-06') } });
    const result = applyShifts(
      changes,
      request({
        what: { kind: 'timeOff', type: 'vacation', note: '', removeShifts: true },
        employeeIds: ['ana', 'ben'],
      }),
    );
    expect(result).toMatchObject({ created: 2, removed: 1 });
    expect(changes.list('timeOff')).toHaveLength(2);
  });
});

describe('planApply', () => {
  it('validates dates, people, weekdays and size', () => {
    expect(planApply(data, request({ to: '2026-10-01' })).error).toMatch(/end date is before/);
    expect(planApply(data, request({ to: '2027-10-11' })).error).toMatch(/longer than a year/);
    expect(planApply(data, request({ employeeIds: [] })).error).toMatch(/No one is picked/);
    expect(planApply(data, request({ weekdays: [] })).error).toMatch(/No weekdays/);
    expect(planApply(data, request()).error).toBeNull();
  });

  it('refuses more than 1,500 shifts', () => {
    const many = makeData({
      employees: Array.from({ length: 30 }, (_, i) => employee(`p${i}`)),
      templates: [template(L)],
    });
    const plan = planApply(many, {
      ...request(),
      employeeIds: Object.keys(many.employees),
      from: '2026-01-01',
      to: '2026-03-31',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(plan.error).toBe("That's 2,700 shifts at once. Pick a shorter range or fewer people.");
  });

  it('does not change the data', () => {
    planApply(data, request());
    expect(data.shifts).toEqual({});
  });
});

describe('apply copy', () => {
  it('summarizes a pattern apply in plain words', () => {
    const withOff = { ...data, timeOff: { t: timeOff('t', 'ben', '2026-10-06', '2026-10-06') } };
    const req = request({
      what: { kind: 'pattern', patternId: 'monThu' },
      employeeIds: ['ana', 'ben'],
      to: '2026-11-01',
    });
    const { result } = planApply(withOff, req);
    expect(describeApply(req, result, withOff, 12)).toBe(
      '2 people work 4×10, Mon to Thu from Oct 5 through Nov 1: 31 shifts. 1 day with time off is skipped. ' +
        'Other shifts in those dates are replaced, and pattern days off are cleared.',
    );
    expect(applyButtonLabel(req, result)).toBe('Apply 31 shifts');
    expect(appliedMessage(req, result)).toBe('Applied 31 shifts.');
  });

  it('summarizes a single person template apply with Keep', () => {
    const req = request({ conflict: 'keep' });
    const { result } = planApply(data, req);
    expect(describeApply(req, result, data, 12)).toBe(
      'Ana Ruiz works Long day (7a–5:30p) on weekdays from Oct 5 through Oct 11: 5 shifts. ' +
        'Days that already have a shift are kept as they are.',
    );
  });
});

describe('pattern link', () => {
  it('records which pattern placed each shift, and not for plain template applies', () => {
    const viaPattern = new ChangeSet(data);
    applyShifts(viaPattern, request({ what: { kind: 'pattern', patternId: 'monThu' } }));
    expect(viaPattern.list('shifts').every((s) => s.patternId === 'monThu')).toBe(true);

    const viaTemplate = new ChangeSet(data);
    applyShifts(viaTemplate, request());
    expect(viaTemplate.list('shifts').every((s) => !s.patternId)).toBe(true);
  });
});

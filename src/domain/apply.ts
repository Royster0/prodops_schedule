import { ChangeSet } from './changeSet';
import { TIME_OFF_LABELS } from './color';
import { WEEKDAY_SHORT, dateRange, daysBetween, isISODate, mondayIndex } from './dates';
import { count, formatShortDate, joinList } from './format';
import { patternDayOn } from './patterns';
import { customShift, shiftFromTemplate } from './shifts';
import { addRange } from './timeOff';
import { formatTimeRange, isHHMM, shiftHours, type Clock } from './time';
import type { HHMM, ID, ISODate, ScheduleData, Shift, TimeOffType } from './types';

/** Applying a shift, custom times, a pattern or time off to many people over a date range. */

export type ApplyWhat =
  | { kind: 'template'; templateId: ID }
  | { kind: 'custom'; start: HHMM; end: HHMM; breakMins: number; label: string; color: string }
  | { kind: 'pattern'; patternId: ID }
  | { kind: 'timeOff'; type: TimeOffType; note: string; removeShifts: boolean };

export interface ApplyRequest {
  what: ApplyWhat;
  employeeIds: readonly ID[];
  from: ISODate;
  to: ISODate;
  /** Monday-based weekday indexes (Mon = 0). Used by template and custom only. */
  weekdays: readonly number[];
  conflict: 'replace' | 'keep';
  skipHolidays: boolean;
}

export interface ApplyResult {
  /** Shifts created, or time off ranges added in time off mode. */
  created: number;
  /** Existing shifts deleted to make room for new ones. */
  replaced: number;
  /** Shifts deleted on pattern days off. */
  cleared: number;
  /** Days that would have had a shift but have time off. */
  skippedTimeOff: number;
  /** Holiday dates left alone. */
  skippedHolidays: number;
  /** Days left alone because they already have a shift ("Keep it"). */
  kept: number;
  /** Shifts removed by time off mode. */
  removed: number;
}

export const MAX_SHIFTS = 1500;
export const MAX_DAYS = 366;
export const WEEKDAYS_MON_TO_FRI: readonly number[] = [0, 1, 2, 3, 4];

const emptyResult = (): ApplyResult => ({
  created: 0,
  replaced: 0,
  cleared: 0,
  skippedTimeOff: 0,
  skippedHolidays: 0,
  kept: 0,
  removed: 0,
});

/** Problems that make the request impossible, before counting shifts. */
export function validateRequest(request: ApplyRequest, data: ScheduleData): string | null {
  const { what } = request;
  if (!isISODate(request.from) || !isISODate(request.to)) return 'Pick a start and end date.';
  if (request.to < request.from) return 'The end date is before the start date. Pick a later end date.';
  if (daysBetween(request.from, request.to) + 1 > MAX_DAYS)
    return 'That range is longer than a year. Pick a shorter range.';
  if (request.employeeIds.length === 0) return 'No one is picked. Choose at least one person.';
  if (what.kind === 'template' && !data.templates[what.templateId]) return 'Pick a shift template.';
  if (what.kind === 'pattern' && !data.patterns[what.patternId]) return 'Pick a work pattern.';
  if (what.kind === 'custom') {
    if (!isHHMM(what.start) || !isHHMM(what.end)) return 'Enter a start and end time.';
    if (shiftHours(what.start, what.end, what.breakMins) === 0) {
      return 'The break is as long as the shift. Shorten the break or lengthen the shift.';
    }
  }
  if ((what.kind === 'template' || what.kind === 'custom') && request.weekdays.length === 0) {
    return 'No weekdays are picked. Choose at least one.';
  }
  return null;
}

/** Applies the request. The whole thing is meant to be one undo entry. */
export function applyShifts(changes: ChangeSet, request: ApplyRequest): ApplyResult {
  const result = emptyResult();
  const { what } = request;
  const dates = dateRange(request.from, request.to);

  if (what.kind === 'timeOff') {
    for (const employeeId of request.employeeIds) {
      const input = { employeeId, start: request.from, end: request.to, type: what.type, note: what.note };
      result.removed += addRange(changes, input, what.removeShifts);
      result.created++;
    }
    return result;
  }

  const holidayDates = new Set(changes.list('holidays').map((h) => h.date));
  const skippedHolidayDates = new Set<ISODate>();
  const pattern = what.kind === 'pattern' ? changes.get('patterns', what.patternId) : undefined;
  const weekdays = new Set(request.weekdays);

  /** The shift to place on this date, null for a pattern day off, undefined to skip. */
  const plan = (employeeId: ID, date: ISODate): Shift | null | undefined => {
    if (what.kind === 'pattern') {
      const templateId = pattern ? patternDayOn(pattern, request.from, date) : '';
      const template = templateId ? changes.get('templates', templateId) : undefined;
      return template ? shiftFromTemplate(template, employeeId, date) : null;
    }
    if (!weekdays.has(mondayIndex(date))) return undefined;
    if (what.kind === 'template') {
      const template = changes.get('templates', what.templateId);
      return template ? shiftFromTemplate(template, employeeId, date) : undefined;
    }
    return customShift(what, employeeId, date);
  };

  for (const employeeId of request.employeeIds) {
    for (const date of dates) {
      if (request.skipHolidays && holidayDates.has(date)) {
        skippedHolidayDates.add(date);
        continue;
      }
      const shift = plan(employeeId, date);
      if (shift === undefined) continue;
      const existing = changes.shiftsAt(employeeId, date);

      if (shift === null) {
        if (request.conflict === 'replace' && !changes.timeOffOn(employeeId, date)) {
          for (const old of existing) changes.remove('shifts', old.id);
          result.cleared += existing.length;
        }
        continue;
      }
      if (changes.timeOffOn(employeeId, date)) {
        result.skippedTimeOff++;
        continue;
      }
      if (existing.length > 0 && request.conflict === 'keep') {
        result.kept++;
        continue;
      }
      for (const old of existing) changes.remove('shifts', old.id);
      result.replaced += existing.length;
      changes.put('shifts', shift);
      result.created++;
    }
  }
  result.skippedHolidays = skippedHolidayDates.size;
  return result;
}

export interface ApplyPlan {
  result: ApplyResult;
  /** Why Apply is disabled, or null when it can go ahead. */
  error: string | null;
}

/** A dry run: what applying would do, and whether it is allowed. */
export function planApply(data: ScheduleData, request: ApplyRequest): ApplyPlan {
  const invalid = validateRequest(request, data);
  if (invalid) return { result: emptyResult(), error: invalid };
  const result = applyShifts(new ChangeSet(data), request);
  if (request.what.kind !== 'timeOff' && result.created > MAX_SHIFTS) {
    return {
      result,
      error: `That's ${count(result.created, 'shift')} at once. Pick a shorter range or fewer people.`,
    };
  }
  return { result, error: null };
}

/** True when applying would change nothing. */
export function isNoOp(request: ApplyRequest, result: ApplyResult): boolean {
  if (request.what.kind === 'timeOff') return result.created === 0;
  return result.created + result.replaced + result.cleared === 0;
}

/** "Long day (7a–5:30p)" or "Inventory count (8a–12p)". */
function shiftText(
  what: Extract<ApplyWhat, { kind: 'template' | 'custom' }>,
  data: ScheduleData,
  clock: Clock,
): string {
  if (what.kind === 'custom') {
    return `${what.label.trim() || 'a one-off shift'} (${formatTimeRange(what.start, what.end, clock)})`;
  }
  const template = data.templates[what.templateId];
  return template ? `${template.name} (${formatTimeRange(template.start, template.end, clock)})` : 'a shift';
}

function weekdaysPhrase(weekdays: readonly number[]): string {
  const sorted = [...weekdays].sort();
  if (sorted.length === 7) return 'every day';
  if (sorted.join() === WEEKDAYS_MON_TO_FRI.join()) return 'on weekdays';
  if (sorted.join() === '5,6') return 'on weekends';
  return `on ${joinList(sorted.map((i) => WEEKDAY_SHORT[(i + 1) % 7]))}`;
}

/**
 * A plain summary, e.g. "5 people work 4×10, Mon to Thu from Oct 5 through
 * Nov 1: 80 shifts. 1 day with time off is skipped. Other shifts in those
 * dates are replaced, and pattern days off are cleared."
 */
export function describeApply(
  request: ApplyRequest,
  result: ApplyResult,
  data: ScheduleData,
  clock: Clock,
): string {
  const { what } = request;
  const single = request.employeeIds.length === 1;
  const who = single
    ? (data.employees[request.employeeIds[0]]?.name ?? '1 person')
    : count(request.employeeIds.length, 'person', 'people');
  const range = `from ${formatShortDate(request.from)} through ${formatShortDate(request.to)}`;

  if (what.kind === 'timeOff') {
    const type = TIME_OFF_LABELS[what.type].toLowerCase();
    const days = count(daysBetween(request.from, request.to) + 1, 'day');
    const sentences = [
      `${who} ${single ? 'is' : 'are'} off (${type}) ${range}: ${days}${single ? '' : ' each'}.`,
    ];
    if (what.removeShifts) {
      sentences.push(
        result.removed > 0
          ? `${count(result.removed, 'shift')} in those dates ${result.removed === 1 ? 'is' : 'are'} removed.`
          : 'There are no shifts in those dates to remove.',
      );
    } else if (result.removed === 0) {
      sentences.push('Shifts in those dates stay and show a warning.');
    }
    return sentences.join(' ');
  }

  const whatText =
    what.kind === 'pattern'
      ? (data.patterns[what.patternId]?.name ?? 'a pattern')
      : `${shiftText(what, data, clock)} ${weekdaysPhrase(request.weekdays)}`;

  const sentences = [
    `${who} ${single ? 'works' : 'work'} ${whatText} ${range}: ${count(result.created, 'shift')}.`,
  ];
  if (result.skippedTimeOff > 0) {
    sentences.push(
      `${count(result.skippedTimeOff, 'day')} with time off ${result.skippedTimeOff === 1 ? 'is' : 'are'} skipped.`,
    );
  }
  if (result.skippedHolidays > 0) {
    sentences.push(
      `${count(result.skippedHolidays, 'holiday')} ${result.skippedHolidays === 1 ? 'is' : 'are'} skipped.`,
    );
  }
  if (request.conflict === 'replace') {
    sentences.push(
      what.kind === 'pattern'
        ? 'Other shifts in those dates are replaced, and pattern days off are cleared.'
        : 'Other shifts on those days are replaced.',
    );
  } else {
    sentences.push(
      result.kept > 0
        ? `${count(result.kept, 'day')} that already ${result.kept === 1 ? 'has' : 'have'} a shift ${result.kept === 1 ? 'is' : 'are'} kept as ${result.kept === 1 ? 'it is' : 'they are'}.`
        : 'Days that already have a shift are kept as they are.',
    );
  }
  return sentences.join(' ');
}

/** "Apply 80 shifts", or "Add time off" for time off mode. */
export function applyButtonLabel(request: ApplyRequest, result: ApplyResult): string {
  if (request.what.kind === 'timeOff') {
    return request.employeeIds.length > 1
      ? `Add time off for ${count(request.employeeIds.length, 'person', 'people')}`
      : 'Add time off';
  }
  return `Apply ${count(result.created, 'shift')}`;
}

/** "Applied 80 shifts." The toast after applying. */
export function appliedMessage(request: ApplyRequest, result: ApplyResult): string {
  if (request.what.kind === 'timeOff') {
    return `Added time off for ${count(result.created, 'person', 'people')}.`;
  }
  return `Applied ${count(result.created, 'shift')}.`;
}

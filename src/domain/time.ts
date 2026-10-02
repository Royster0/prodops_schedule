import type { HHMM } from './types';

/** Time-of-day helpers. Times are 'HH:MM' strings in 24-hour form. */

export const MINUTES_PER_DAY = 1440;

const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isHHMM(value: unknown): value is HHMM {
  return typeof value === 'string' && HHMM_PATTERN.test(value);
}

export function toMinutes(time: HHMM): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes since midnight to 'HH:MM', wrapping past midnight. */
export function fromMinutes(minutes: number): HHMM {
  const wrapped = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** A shift whose end is on or before its start ends the next day. */
export function endsNextDay(start: HHMM, end: HHMM): boolean {
  return toMinutes(end) <= toMinutes(start);
}

/** Length of a shift in minutes, including the break. */
export function spanMinutes(start: HHMM, end: HHMM): number {
  const span = toMinutes(end) - toMinutes(start);
  return span > 0 ? span : span + MINUTES_PER_DAY;
}

/** Scheduled hours: span minus break, never below zero. */
export function shiftHours(start: HHMM, end: HHMM, breakMins: number): number {
  return Math.max(0, (spanMinutes(start, end) - breakMins) / 60);
}

/** 40 -> '40h', 38.5 -> '38.5h', 7.75 -> '7.75h'. */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded}h`;
}

export type Clock = 12 | 24;

/**
 * Formats a time of day.
 * 12-hour compact: '7a', '5:30p', '12p'. 12-hour long: '7:00 AM'. 24-hour: '07:00'.
 */
export function formatTime(time: HHMM, clock: Clock, style: 'compact' | 'long' = 'compact'): string {
  if (clock === 24) return time;
  const minutes = toMinutes(time);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const isPm = h24 >= 12;
  if (style === 'long') return `${h12}:${String(m).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  return `${h12}${m === 0 ? '' : `:${String(m).padStart(2, '0')}`}${isPm ? 'p' : 'a'}`;
}

/** '7a–5:30p' or '07:00–17:30'. Uses an en dash. */
export function formatTimeRange(start: HHMM, end: HHMM, clock: Clock): string {
  return `${formatTime(start, clock)}–${formatTime(end, clock)}`;
}

/** Hour labels for axes: '6a', '12p' or '06'. Hour 24 reads as midnight. */
export function formatHour(hour: number, clock: Clock): string {
  const h = hour % 24;
  if (clock === 24) return String(h).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h >= 12 ? 'p' : 'a'}`;
}

/** Rounds minutes down to a step, e.g. 30 minutes. */
export function floorToStep(minutes: number, step: number): number {
  return Math.floor(minutes / step) * step;
}

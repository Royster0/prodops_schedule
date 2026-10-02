import { clearShifts, copyFromEarlier } from '../domain/copy';
import { count } from '../domain/format';
import { COPY_OFFSET_DAYS } from '../domain/period';
import { dateRange } from '../domain/dates';
import { selectPeriod, selectVisibleIds } from './derived';
import { scheduleStore } from './useScheduleStore';

/** Actions on whatever the board currently shows: the period and the visible people. */

const COPY_SOURCES = { day: 'the same day last week', week: 'last week', twoWeeks: 'the previous 2 weeks' } as const;

export function copyPreviousPeriod(): void {
  const state = scheduleStore.getState();
  const offset = COPY_OFFSET_DAYS[state.view];
  if (!offset || state.view === 'month') return;
  const source = COPY_SOURCES[state.view];
  const period = selectPeriod(state);
  state.commit('copy shifts', (changes) => copyFromEarlier(changes, selectVisibleIds(state), period.dates, offset), {
    toast: ({ copied, skipped }) =>
      `Copied ${count(copied, 'shift')} from ${source}.` +
      (skipped > 0 ? ` Skipped ${count(skipped, 'day')} with time off.` : ''),
  });
}

/** Clears shifts for visible people in the period. In Month, only the month's own days. */
export function clearShownShifts(): void {
  const state = scheduleStore.getState();
  const period = selectPeriod(state);
  const dates = state.view === 'month' ? dateRange(period.start, period.end) : period.dates;
  state.commit('clear shifts', (changes) => clearShifts(changes, selectVisibleIds(state), dates), {
    toast: (removed) => (removed > 0 ? `Cleared ${count(removed, 'shift')}.` : 'There were no shifts to clear.'),
  });
}

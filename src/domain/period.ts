import {
  MONTH_SHORT,
  addDays,
  addMonths,
  dateRange,
  monthBounds,
  monthGrid,
  parts,
  startOfWeek,
} from './dates';
import { formatDateRange, formatDayLabel, formatMonthYear } from './format';
import type { ISODate, ViewMode } from './types';

/** The dates a view shows around an anchor date, and how to move between periods. */

export interface Period {
  view: ViewMode;
  /** Every date rendered, in order. Month includes faded days from neighboring months. */
  dates: ISODate[];
  /** The dates that belong to the period: the month's own days in Month view. */
  start: ISODate;
  end: ISODate;
}

export function periodFor(view: ViewMode, anchor: ISODate, weekStart: 0 | 1): Period {
  switch (view) {
    case 'day':
      return { view, dates: [anchor], start: anchor, end: anchor };
    case 'week':
    case 'twoWeeks': {
      const start = startOfWeek(anchor, weekStart);
      const end = addDays(start, view === 'week' ? 6 : 13);
      return { view, dates: dateRange(start, end), start, end };
    }
    case 'month': {
      const { start, end } = monthBounds(anchor);
      return { view, dates: monthGrid(anchor, weekStart).flat(), start, end };
    }
  }
}

/** The anchor for the previous (-1) or next (+1) period. */
export function shiftAnchor(view: ViewMode, anchor: ISODate, direction: -1 | 1): ISODate {
  switch (view) {
    case 'day':
      return addDays(anchor, direction);
    case 'week':
      return addDays(anchor, 7 * direction);
    case 'twoWeeks':
      return addDays(anchor, 14 * direction);
    case 'month':
      return addMonths(monthBounds(anchor).start, direction);
  }
}

/** Header label: 'Fri, Oct 2', 'Sep 28–Oct 4' or 'October 2026' ('Oct 2026' when short). */
export function periodLabel(period: Period, short = false): string {
  switch (period.view) {
    case 'day':
      return formatDayLabel(period.start);
    case 'week':
    case 'twoWeeks':
      return formatDateRange(period.start, period.end);
    case 'month': {
      const { year, month } = parts(period.start);
      return short ? `${MONTH_SHORT[month - 1]} ${year}` : formatMonthYear(period.start);
    }
  }
}

export const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'Day',
  week: 'Week',
  twoWeeks: '2 weeks',
  month: 'Month',
};

/** How far back "Copy" looks for each view. Month has no copy. */
export const COPY_OFFSET_DAYS: Partial<Record<ViewMode, number>> = { day: 7, week: 7, twoWeeks: 14 };

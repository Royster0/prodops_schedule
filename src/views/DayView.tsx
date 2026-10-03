import { AnimatePresence } from 'motion/react';
import { memo, useMemo, type CSSProperties, type MouseEvent } from 'react';
import { ShiftBar } from '../components/ShiftBar';
import { TIME_OFF_COLORS, TIME_OFF_LABELS } from '../domain/color';
import { conflictingShiftIds, hourlyCoverage, timelineHours } from '../domain/coverage';
import { addDays, today as todayOf } from '../domain/dates';
import { formatDayLabel } from '../domain/format';
import { shiftsIn, timeOffIn } from '../domain/scheduleIndex';
import { hoursOf, shiftInterval } from '../domain/shifts';
import { MINUTES_PER_DAY, floorToStep, formatHour, fromMinutes } from '../domain/time';
import type { Employee, ISODate, Shift, TimeOff } from '../domain/types';
import { NARROW, useMediaQuery } from '../hooks/useMediaQuery';
import { useNow } from '../hooks/useNow';
import {
  selectHolidaysByDate,
  selectPeriod,
  selectShiftCells,
  selectTimeOffCells,
  selectVisibleEmployees,
} from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { useBlockContext, type BlockContext } from './blockContext';
import { cellOf, handleCellClick } from './cellActions';
import styles from './DayView.module.css';
import { RowHeader } from './RowHeader';
import { Corner, NoMatches } from './WeekView';

interface Range {
  start: number;
  end: number;
}

/** Day view: one timeline lane per person, with coverage per hour above. */
export function DayView() {
  const date = useScheduleStore((s) => selectPeriod(s).start);
  const employees = useScheduleStore(selectVisibleEmployees);
  const shiftCells = useScheduleStore(selectShiftCells);
  const timeOffCells = useScheduleStore(selectTimeOffCells);
  const holiday = useScheduleStore((s) => selectHolidaysByDate(s).get(date));
  const selectedIds = useScheduleStore((s) => s.selectedIds);
  const ctx = useBlockContext();
  const now = useNow();
  const yesterday = addDays(date, -1);

  const people = useMemo(
    () =>
      employees.map((e) => ({
        employeeId: e.id,
        today: shiftsIn(shiftCells, e.id, date),
        yesterday: shiftsIn(shiftCells, e.id, yesterday),
      })),
    [employees, shiftCells, date, yesterday],
  );

  const range = useMemo(
    () =>
      timelineHours(
        ctx.dayStart,
        ctx.dayEnd,
        people.flatMap((p) => p.today),
        people.flatMap((p) => p.yesterday),
      ),
    [ctx.dayStart, ctx.dayEnd, people],
  );
  const counts = useMemo(
    () => hourlyCoverage(people, ctx.matcher, range.start, range.end),
    [people, ctx.matcher, range],
  );
  const hours = range.end - range.start;
  const nowFraction =
    todayOf(now) === date ? (now.getHours() * 60 + now.getMinutes() - range.start * 60) / (hours * 60) : null;

  return (
    <div className={styles.grid} style={{ '--hours': hours } as CSSProperties}>
      <Corner shown={employees} />
      <TimelineHeader
        range={range}
        counts={counts}
        maxPeople={employees.length}
        clock={ctx.clock}
        holiday={holiday?.name}
      />
      {employees.map((employee) => (
        <DayRow
          key={employee.id}
          employee={employee}
          date={date}
          shifts={shiftsIn(shiftCells, employee.id, date)}
          yesterday={shiftsIn(shiftCells, employee.id, yesterday)}
          timeOff={timeOffIn(timeOffCells, employee.id, date)}
          selected={selectedIds.has(employee.id)}
          range={range}
          nowFraction={nowFraction}
          ctx={ctx}
        />
      ))}
      {employees.length === 0 && <NoMatches />}
    </div>
  );
}

interface TimelineHeaderProps {
  range: Range;
  counts: readonly number[];
  maxPeople: number;
  clock: 12 | 24;
  holiday?: string;
}

/** Coverage histogram with the count printed, then hour ticks. */
function TimelineHeader({ range, counts, maxPeople, clock, holiday }: TimelineHeaderProps) {
  const hours = range.end - range.start;
  const narrow = useMediaQuery(NARROW);
  // Labels like '10:00p' need room: fewer of them on a phone.
  const tickEvery = narrow ? (hours > 12 ? 4 : 2) : hours > 14 ? 2 : 1;
  const scale = Math.max(1, maxPeople);
  return (
    <div className={styles.timelineHeader}>
      {holiday && <div className={styles.holiday}>{holiday}</div>}
      <div className={styles.histogram} aria-label="People working each hour">
        {counts.map((n, i) => (
          <div
            key={i}
            className={styles.histogramColumn}
            title={`${formatHour(range.start + i, clock)}: ${n} on`}
          >
            <span className={styles.histogramCount}>{n}</span>
            <span className={styles.histogramBar} style={{ height: `${(n / scale) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {counts.map((_, i) => (
          <span key={i} className={styles.tick}>
            {(range.start + i) % tickEvery === 0 ? formatHour(range.start + i, clock) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

interface DayRowProps {
  employee: Employee;
  date: ISODate;
  shifts: readonly Shift[];
  yesterday: readonly Shift[];
  timeOff: TimeOff | undefined;
  selected: boolean;
  range: Range;
  nowFraction: number | null;
  ctx: BlockContext;
}

const DayRow = memo(function DayRow({
  employee,
  date,
  shifts,
  yesterday,
  timeOff,
  selected,
  range,
  nowFraction,
  ctx,
}: DayRowProps) {
  const span = (range.end - range.start) * 60;
  const offset = range.start * 60;
  const spill = yesterday.filter((s) => shiftInterval(s)[1] > MINUTES_PER_DAY);
  const bars = [
    ...spill.map((shift) => ({ shift, spillover: true })),
    ...shifts.map((shift) => ({ shift, spillover: false })),
  ];
  const conflicts = conflictingShiftIds(shifts, yesterday, timeOff);
  const hours = shifts.reduce((sum, s) => sum + hoursOf(s), 0);

  const place = (shift: Shift, spillover: boolean) => {
    const [from, to] = shiftInterval(shift);
    const start = spillover ? 0 : from - offset;
    const end = spillover ? to - MINUTES_PER_DAY - offset : to - offset;
    const left = Math.min(Math.max(start / span, 0), 1);
    const right = Math.min(Math.max(end / span, 0), 1);
    return { left, width: Math.max(right - left, 0) };
  };

  return (
    <>
      <div className={styles.rowHeader}>
        <RowHeader
          employee={employee}
          tagsById={ctx.tags}
          selected={selected}
          hours={hours}
          days={0}
          showDays={false}
        />
      </div>
      <div
        className={styles.lane}
        style={{ '--lanes': Math.max(bars.length, 1) } as CSSProperties}
        data-cell=""
        data-employee-id={employee.id}
        data-date={date}
      >
        {!ctx.readOnly && (
          <button
            type="button"
            className={styles.laneButton}
            onClick={handleLaneClick}
            data-range-start={range.start}
            data-range-end={range.end}
            aria-label={`Add a shift for ${employee.name} on ${formatDayLabel(date)}`}
          />
        )}
        {timeOff && (
          <button
            type="button"
            className={styles.timeOff}
            style={{ '--off': TIME_OFF_COLORS[timeOff.type] } as CSSProperties}
            data-time-off-id={timeOff.id}
            onClick={handleCellClick}
            aria-label={`${TIME_OFF_LABELS[timeOff.type]} time off`}
          >
            {TIME_OFF_LABELS[timeOff.type]}
          </button>
        )}
        <AnimatePresence initial={false}>
          {bars.map(({ shift, spillover }, i) => {
            const { left, width } = place(shift, spillover);
            if (width === 0) return null;
            return (
              <ShiftBar
                key={shift.id}
                shift={shift}
                templates={ctx.templates}
                clock={ctx.clock}
                left={left}
                width={width}
                lane={i}
                lanes={bars.length}
                spillover={spillover}
                dimmed={!ctx.matcher.shift(shift)}
                warning={!spillover && conflicts.has(shift.id)}
                onClick={handleCellClick}
              />
            );
          })}
        </AnimatePresence>
        {nowFraction !== null && nowFraction >= 0 && nowFraction <= 1 && (
          <span className={styles.now} style={{ left: `${nowFraction * 100}%` }} aria-hidden="true" />
        )}
      </div>
    </>
  );
});

/** A click on an empty spot opens a new shift starting there, rounded down to 30 minutes. */
function handleLaneClick(event: MouseEvent<HTMLButtonElement>) {
  const state = scheduleStore.getState();
  const button = event.currentTarget;
  const cell = cellOf(button);
  if (!cell) return;
  if (state.tool.kind !== 'select') {
    handleCellClick(event);
    return;
  }
  const start = Number(button.dataset.rangeStart);
  const end = Number(button.dataset.rangeEnd);
  let minutes = 9 * 60;
  if (event.detail > 0) {
    const rect = button.getBoundingClientRect();
    const fraction = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    minutes = floorToStep(start * 60 + fraction * (end - start) * 60, 30);
  }
  state.openSheet({
    kind: 'shift',
    employeeId: cell.employeeId,
    date: cell.date,
    start: fromMinutes(minutes),
  });
}

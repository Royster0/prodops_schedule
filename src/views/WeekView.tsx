import { AnimatePresence } from 'motion/react';
import { memo, useMemo, type CSSProperties } from 'react';
import { CoverageStrip } from '../components/CoverageStrip';
import { Icon } from '../components/Icon';
import { ShiftBlock } from '../components/ShiftBlock';
import { TimeOffBlock } from '../components/TimeOffBlock';
import { conflictingShiftIds, dayCoverage } from '../domain/coverage';
import { MONTH_SHORT, WEEKDAY_SHORT, addDays, dayOfWeek, isWeekend, parts } from '../domain/dates';
import { count, formatDayLabel } from '../domain/format';
import { dayShifts, rowShifts, rowTimeOff } from '../domain/scheduleIndex';
import { hoursOf } from '../domain/shifts';
import type { Clock } from '../domain/time';
import type { Employee, Holiday, ID, ISODate, Shift, TimeOff } from '../domain/types';
import { useToday } from '../hooks/useNow';
import {
  selectEmployees,
  selectHolidaysByDate,
  selectPeriod,
  selectShiftCells,
  selectTimeOffCells,
  selectVisibleEmployees,
  selectVisibleIds,
} from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { useBlockContext, type BlockContext } from './blockContext';
import { handleCellClick, handleDateClick } from './cellActions';
import { RowHeader } from './RowHeader';
import styles from './WeekView.module.css';

/** Week and 2 weeks: a sticky name column plus one column per day. */
export function WeekView({ compact }: { compact: boolean }) {
  const period = useScheduleStore(selectPeriod);
  const employees = useScheduleStore(selectVisibleEmployees);
  const shiftCells = useScheduleStore(selectShiftCells);
  const timeOffCells = useScheduleStore(selectTimeOffCells);
  const holidays = useScheduleStore(selectHolidaysByDate);
  const selectedIds = useScheduleStore((s) => s.selectedIds);
  const painting = useScheduleStore((s) => s.tool.kind !== 'select');
  const ctx = useBlockContext();
  const today = useToday();
  const dates = period.dates;
  const previousDates = useMemo(() => dates.map((date) => addDays(date, -1)), [dates]);

  const employeeIds = useScheduleStore(selectVisibleIds);
  const coverage = dates.map((date, i) =>
    dayCoverage(
      dayShifts(shiftCells, employeeIds, date),
      dayShifts(shiftCells, employeeIds, previousDates[i]),
      ctx.matcher,
      ctx.dayStart,
      ctx.dayEnd,
    ),
  );

  return (
    <div
      className={[styles.grid, compact && styles.compact].filter(Boolean).join(' ')}
      style={{ '--days': dates.length } as CSSProperties}
    >
      <Corner shown={employees} />
      {dates.map((date, i) => (
        <DayHeader
          key={date}
          date={date}
          showMonth={i === 0 || parts(date).day === 1}
          holiday={holidays.get(date)}
          isToday={date === today}
          counts={coverage[i].counts}
          total={coverage[i].total}
          maxPeople={employees.length}
          clock={ctx.clock}
          dayStart={ctx.dayStart}
          painting={painting}
        />
      ))}
      {employees.map((employee) => (
        <WeekRow
          key={employee.id}
          employee={employee}
          dates={dates}
          shifts={rowShifts(shiftCells, employee.id, dates)}
          yesterday={rowShifts(shiftCells, employee.id, previousDates)}
          timeOff={rowTimeOff(timeOffCells, employee.id, dates)}
          holidays={holidays}
          today={today}
          selected={selectedIds.has(employee.id)}
          compact={compact}
          ctx={ctx}
        />
      ))}
      {employees.length === 0 && <NoMatches />}
    </div>
  );
}

export function NoMatches() {
  return (
    <div className={styles.noMatches}>
      <p>No one matches these filters.</p>
      <button type="button" onClick={() => scheduleStore.getState().clearFilters()}>
        Clear filters
      </button>
    </div>
  );
}

/** "5 people" plus Select all or Clear selection. */
export function Corner({ shown }: { shown: readonly Employee[] }) {
  const total = useScheduleStore((s) => selectEmployees(s).length);
  const anySelected = useScheduleStore((s) => s.selectedIds.size > 0);
  const { setSelected, clearSelection } = scheduleStore.getState();
  return (
    <div className={styles.corner}>
      <span className={styles.peopleCount}>
        {shown.length < total
          ? `${shown.length} of ${count(total, 'person', 'people')}`
          : count(total, 'person', 'people')}
      </span>
      <button
        type="button"
        className={styles.selectAll}
        onClick={() => (anySelected ? clearSelection() : setSelected(shown.map((e) => e.id)))}
      >
        {anySelected ? 'Clear selection' : 'Select all'}
      </button>
    </div>
  );
}

interface DayHeaderProps {
  date: ISODate;
  showMonth: boolean;
  holiday: Holiday | undefined;
  isToday: boolean;
  counts: readonly number[];
  total: number;
  maxPeople: number;
  clock: Clock;
  dayStart: number;
  painting: boolean;
}

const DayHeader = memo(function DayHeader({
  date,
  showMonth,
  holiday,
  isToday,
  counts,
  total,
  maxPeople,
  clock,
  dayStart,
  painting,
}: DayHeaderProps) {
  const { month, day } = parts(date);
  const dow = dayOfWeek(date);
  const label = painting
    ? `Fill ${formatDayLabel(date)} for everyone shown`
    : `${formatDayLabel(date)}${holiday ? `, ${holiday.name}` : ''}, ${total} on. Open in Day view`;
  return (
    <button
      type="button"
      className={[
        styles.dayHeader,
        isWeekend(date) && styles.weekend,
        holiday && styles.holiday,
        isToday && styles.today,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => handleDateClick(date)}
      aria-label={label}
      aria-current={isToday ? 'date' : undefined}
    >
      <span className={styles.weekday}>
        {WEEKDAY_SHORT[dow]}
        {showMonth && <span className={styles.month}> {MONTH_SHORT[month - 1]}</span>}
      </span>
      <span className={styles.dateNumber}>{day}</span>
      <span className={styles.holidayName}>{holiday?.name}</span>
      <CoverageStrip counts={counts} fromHour={dayStart} total={total} max={maxPeople} clock={clock} />
    </button>
  );
});

interface WeekRowProps {
  employee: Employee;
  dates: readonly ISODate[];
  /** This person's shifts and time off for each date, plus the day before each date. */
  shifts: readonly (readonly Shift[])[];
  yesterday: readonly (readonly Shift[])[];
  timeOff: readonly (TimeOff | undefined)[];
  holidays: ReadonlyMap<ISODate, Holiday>;
  today: ISODate;
  selected: boolean;
  compact: boolean;
  ctx: BlockContext;
}

/** One person's row. Re-renders only when one of its own cells changed. */
const WeekRow = memo(function WeekRow({
  employee,
  dates,
  shifts,
  yesterday,
  timeOff,
  holidays,
  today,
  selected,
  compact,
  ctx,
}: WeekRowProps) {
  let hours = 0;
  let days = 0;
  for (const cell of shifts) {
    if (cell.length > 0) days++;
    for (const shift of cell) hours += hoursOf(shift);
  }
  return (
    <>
      <div className={styles.rowHeader}>
        <RowHeader employee={employee} tagsById={ctx.tags} selected={selected} hours={hours} days={days} />
      </div>
      {dates.map((date, i) => (
        <WeekCell
          key={date}
          employeeId={employee.id}
          employeeName={employee.name}
          date={date}
          shifts={shifts[i]}
          yesterday={yesterday[i]}
          timeOff={timeOff[i]}
          tint={
            date === today ? 'today' : holidays.has(date) ? 'holiday' : isWeekend(date) ? 'weekend' : null
          }
          compact={compact}
          ctx={ctx}
        />
      ))}
    </>
  );
});

interface WeekCellProps {
  employeeId: ID;
  employeeName: string;
  date: ISODate;
  shifts: readonly Shift[];
  yesterday: readonly Shift[];
  timeOff: TimeOff | undefined;
  tint: 'today' | 'holiday' | 'weekend' | null;
  compact: boolean;
  ctx: BlockContext;
}

const TINT_CLASSES = { today: styles.cellToday, holiday: styles.cellHoliday, weekend: styles.cellWeekend };

/** One person on one day. Re-renders only when its own shifts or time off change. */
const WeekCell = memo(function WeekCell({
  employeeId,
  employeeName,
  date,
  shifts,
  yesterday,
  timeOff,
  tint,
  compact,
  ctx,
}: WeekCellProps) {
  const conflicts = shifts.length > 0 ? conflictingShiftIds(shifts, yesterday, timeOff) : null;
  const empty = shifts.length === 0 && !timeOff;
  return (
    <div
      className={[styles.cell, tint && TINT_CLASSES[tint]].filter(Boolean).join(' ')}
      data-cell=""
      data-employee-id={employeeId}
      data-date={date}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {timeOff && (
          <TimeOffBlock
            key="time-off"
            timeOff={timeOff}
            date={date}
            compact={compact}
            dimmed={!ctx.matcher.timeOff(timeOff)}
            onClick={handleCellClick}
          />
        )}
        {shifts.map((shift) => (
          <ShiftBlock
            key={shift.id}
            shift={shift}
            templates={ctx.templates}
            tags={ctx.tags}
            clock={ctx.clock}
            dayStart={ctx.dayStart}
            dayEnd={ctx.dayEnd}
            compact={compact}
            dimmed={!ctx.matcher.shift(shift)}
            warning={conflicts?.has(shift.id)}
            onClick={handleCellClick}
          />
        ))}
      </AnimatePresence>
      {empty && (
        <button
          type="button"
          className={styles.add}
          onClick={handleCellClick}
          aria-label={`Add a shift for ${employeeName} on ${formatDayLabel(date)}`}
        >
          <Icon name="plus" size={16} />
        </button>
      )}
    </div>
  );
});

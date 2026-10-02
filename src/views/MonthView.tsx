import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo, type CSSProperties, type MouseEvent } from 'react';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { TIME_OFF_COLORS, TIME_OFF_LABELS, textOn } from '../domain/color';
import { headcount } from '../domain/coverage';
import { MONTH_SHORT, WEEKDAY_SHORT, dateRange, isSameMonth, isWeekend, parts } from '../domain/dates';
import { formatDayLabel, initials } from '../domain/format';
import { dayShifts, dayTimeOff, shiftsIn, type ShiftCells } from '../domain/scheduleIndex';
import { hoursOf, shiftColor, shiftName } from '../domain/shifts';
import { formatHours, formatTimeRange } from '../domain/time';
import type { Employee, Holiday, ISODate, Shift, TimeOff } from '../domain/types';
import { useToday } from '../hooks/useNow';
import { isFreshShift, isFreshTimeOff } from '../store/freshness';
import {
  selectHolidaysByDate,
  selectPeriod,
  selectShiftCells,
  selectTimeOffCells,
  selectVisibleEmployees,
  selectVisibleIds,
} from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { useBlockContext, type BlockContext } from './blockContext';
import { handleDateClick, handleMonthDayAdd } from './cellActions';
import styles from './MonthView.module.css';
import { NoMatches } from './WeekView';

/**
 * Month view: a calendar listing each day's shifts, time off and holidays.
 * Select people in the strip above to paint their days with a brush, or to
 * add a shift by tapping a day.
 */
export function MonthView() {
  const period = useScheduleStore(selectPeriod);
  const employees = useScheduleStore(selectVisibleEmployees);
  const employeeIds = useScheduleStore(selectVisibleIds);
  const shiftCells = useScheduleStore(selectShiftCells);
  const timeOffCells = useScheduleStore(selectTimeOffCells);
  const holidays = useScheduleStore(selectHolidaysByDate);
  const weekStart = useScheduleStore((s) => s.data.settings.weekStart);
  const painting = useScheduleStore((s) => s.tool.kind !== 'select');
  const ctx = useBlockContext();
  const today = useToday();
  const weekdays = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);

  return (
    <div className={styles.month}>
      <Legend employees={employees} shiftCells={shiftCells} start={period.start} end={period.end} />
      <div className={styles.calendar}>
        {weekdays.map((dow) => (
          <div key={dow} className={styles.weekday}>
            {WEEKDAY_SHORT[dow]}
          </div>
        ))}
        {period.dates.map((date) => (
          <MonthDay
            key={date}
            date={date}
            inMonth={isSameMonth(date, period.start)}
            isToday={date === today}
            holiday={holidays.get(date)}
            employees={employees}
            shifts={dayShifts(shiftCells, employeeIds, date)}
            timeOff={dayTimeOff(timeOffCells, employeeIds, date)}
            painting={painting}
            ctx={ctx}
          />
        ))}
      </div>
      {employees.length === 0 && <NoMatches />}
    </div>
  );
}

interface LegendProps {
  employees: readonly Employee[];
  shiftCells: ShiftCells;
  start: ISODate;
  end: ISODate;
}

/** People chips with hours this month. Tapping one selects that person for painting and adding. */
function Legend({ employees, shiftCells, start, end }: LegendProps) {
  const selectedIds = useScheduleStore((s) => s.selectedIds);
  const { toggleSelected, setSelected, clearSelection } = scheduleStore.getState();
  const monthDates = useMemo(() => dateRange(start, end), [start, end]);
  const hours = useMemo(() => {
    const totals = new Map<string, number>();
    for (const employee of employees) {
      let sum = 0;
      for (const date of monthDates) {
        for (const shift of shiftsIn(shiftCells, employee.id, date)) sum += hoursOf(shift);
      }
      totals.set(employee.id, sum);
    }
    return totals;
  }, [employees, shiftCells, monthDates]);

  return (
    <div className={styles.legend}>
      {employees.map((employee) => (
        <button
          key={employee.id}
          type="button"
          className={styles.legendChip}
          aria-pressed={selectedIds.has(employee.id)}
          aria-label={`Select ${employee.name}`}
          onClick={() => toggleSelected(employee.id)}
        >
          <Avatar
            name={employee.name}
            color={employee.color}
            selected={selectedIds.has(employee.id)}
            size="sm"
          />
          <span className={styles.legendName}>{employee.name}</span>
          <span className={styles.legendHours}>{formatHours(hours.get(employee.id) ?? 0)}</span>
        </button>
      ))}
      <button
        type="button"
        className={styles.legendSelectAll}
        onClick={() => (selectedIds.size > 0 ? clearSelection() : setSelected(employees.map((e) => e.id)))}
      >
        {selectedIds.size > 0 ? 'Clear selection' : 'Select all'}
      </button>
      {selectedIds.size === 0 && employees.length > 0 && (
        <span className={styles.legendHint}>Select people to paint or add their shifts.</span>
      )}
    </div>
  );
}

interface MonthDayProps {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  holiday: Holiday | undefined;
  employees: readonly Employee[];
  /** Each person's shifts and time off on this date, in `employees` order. */
  shifts: readonly (readonly Shift[])[];
  timeOff: readonly (TimeOff | undefined)[];
  painting: boolean;
  ctx: BlockContext;
}

/** Most entries a day lists before "+N more". */
const MAX_ENTRIES = 6;

type Entry = { employee: Employee; shift: Shift } | { employee: Employee; timeOff: TimeOff };

/** One calendar day. Re-renders only when one of its own entries changed. */
const MonthDay = memo(function MonthDay({
  date,
  inMonth,
  isToday,
  holiday,
  employees,
  shifts,
  timeOff,
  painting,
  ctx,
}: MonthDayProps) {
  const { month, day } = parts(date);
  const people = employees.map((e, i) => ({ employeeId: e.id, today: shifts[i], yesterday: [] }));
  const on = headcount(people, ctx.matcher);
  const label = painting
    ? `Fill ${formatDayLabel(date)} for the selected people, or everyone shown`
    : `${formatDayLabel(date)}${holiday ? `, ${holiday.name}` : ''}, ${on} on. Open in Day view`;

  // In people order: each person's time off, then their shifts.
  const entries: Entry[] = employees.flatMap((employee, i) => {
    const off = timeOff[i];
    return [...(off ? [{ employee, timeOff: off }] : []), ...shifts[i].map((shift) => ({ employee, shift }))];
  });
  const shown = entries.length > MAX_ENTRIES ? entries.slice(0, MAX_ENTRIES - 1) : entries;
  const more = entries.length - shown.length;

  return (
    <div
      className={[
        styles.day,
        !inMonth && styles.outside,
        isWeekend(date) && styles.weekend,
        holiday && styles.holiday,
        isToday && styles.today,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={styles.dayHeader}
        onClick={() => handleDateClick(date)}
        aria-label={label}
        aria-current={isToday ? 'date' : undefined}
      >
        <span className={styles.dateNumber}>
          {day === 1 && <span className={styles.monthName}>{MONTH_SHORT[month - 1]} </span>}
          {day}
        </span>
        <span className={styles.on}>{on} on</span>
      </button>
      {holiday && <span className={styles.holidayName}>{holiday.name}</span>}

      {/* The body of the day is what a brush paints, for the selected people. */}
      <div className={styles.dayBody} data-day-cell="" data-date={date}>
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((entry) =>
            'shift' in entry ? (
              <ShiftEntry key={entry.shift.id} employee={entry.employee} shift={entry.shift} ctx={ctx} />
            ) : (
              <TimeOffEntry
                key={`off-${entry.employee.id}`}
                employee={entry.employee}
                timeOff={entry.timeOff}
                date={date}
                ctx={ctx}
              />
            ),
          )}
        </AnimatePresence>
        {more > 0 && (
          <button
            type="button"
            className={styles.more}
            onClick={() => scheduleStore.getState().openDay(date)}
          >
            +{more} more
          </button>
        )}
        <button
          type="button"
          className={styles.add}
          onClick={(event) => handleMonthDayAdd(event, date)}
          aria-label={
            painting
              ? `Paint ${formatDayLabel(date)} for the selected people`
              : `Add a shift on ${formatDayLabel(date)}`
          }
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
});

const entryMotion = {
  animate: { scale: 1, opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.15 } },
  transition: { type: 'spring', duration: 0.28, bounce: 0.4 },
} as const;

/** Opens the entry's shift or time off. While painting, the stroke handles the tap instead. */
function openEntry(event: MouseEvent<HTMLButtonElement>) {
  const state = scheduleStore.getState();
  if (state.tool.kind !== 'select') return;
  const { shiftId, timeOffId } = event.currentTarget.dataset;
  if (shiftId) state.openSheet({ kind: 'shift', shiftId });
  else if (timeOffId) state.openSheet({ kind: 'timeOff', timeOffId });
}

/** Who works and when: "Ana Ruiz 8a–4:30p" in the shift's color. */
function ShiftEntry({ employee, shift, ctx }: { employee: Employee; shift: Shift; ctx: BlockContext }) {
  const color = shiftColor(shift, ctx.templates);
  const time = formatTimeRange(shift.start, shift.end, ctx.clock);
  const name = shiftName(shift, ctx.templates);
  return (
    <motion.button
      type="button"
      className={[styles.entry, !ctx.matcher.shift(shift) && styles.entryDimmed].filter(Boolean).join(' ')}
      style={{ background: color, color: textOn(color) }}
      data-shift-id={shift.id}
      onClick={openEntry}
      aria-label={`${employee.name}, ${name}, ${time}, ${formatHours(hoursOf(shift))}`}
      title={`${employee.name}: ${name}, ${time}`}
      initial={isFreshShift(shift.id) ? { scale: 0.82, opacity: 0 } : false}
      {...entryMotion}
    >
      <span className={styles.entryName}>
        <span className={styles.fullName}>{employee.name}</span>
        <span className={styles.shortName}>{initials(employee.name)}</span>
      </span>
      <span className={styles.entryDetail}>{time}</span>
    </motion.button>
  );
}

interface TimeOffEntryProps {
  employee: Employee;
  timeOff: TimeOff;
  date: ISODate;
  ctx: BlockContext;
}

/** Who is off and why: "Dev Patel Vacation", hatched in the time off color. */
function TimeOffEntry({ employee, timeOff, date, ctx }: TimeOffEntryProps) {
  const type = TIME_OFF_LABELS[timeOff.type];
  return (
    <motion.button
      type="button"
      className={[styles.entry, styles.offEntry, !ctx.matcher.timeOff(timeOff) && styles.entryDimmed]
        .filter(Boolean)
        .join(' ')}
      style={{ '--off': TIME_OFF_COLORS[timeOff.type] } as CSSProperties}
      data-time-off-id={timeOff.id}
      onClick={openEntry}
      aria-label={`${employee.name}, ${type} time off`}
      title={`${employee.name}: ${type}`}
      initial={isFreshTimeOff(employee.id, date) ? { scale: 0.82, opacity: 0 } : false}
      {...entryMotion}
    >
      <span className={styles.entryName}>
        <span className={styles.fullName}>{employee.name}</span>
        <span className={styles.shortName}>{initials(employee.name)}</span>
      </span>
      <span className={styles.entryDetail}>{type}</span>
    </motion.button>
  );
}

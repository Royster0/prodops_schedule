import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo, type CSSProperties } from 'react';
import { Avatar } from '../components/Avatar';
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
import { handleCellClick, handleDateClick } from './cellActions';
import styles from './MonthView.module.css';
import { NoMatches } from './WeekView';

/**
 * Month view: a calendar listing each day's shifts and holidays. While a brush
 * is active, every day shows one slot per person, always in the same order, so
 * any day can be painted.
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
      <div className={[styles.calendar, employees.length > 8 && styles.crowded].filter(Boolean).join(' ')}>
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

/** People chips with hours this month. Avatars toggle selection. */
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

/** One calendar day. Re-renders only when one of its own slots changed. */
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
    ? `Fill ${formatDayLabel(date)} for everyone shown`
    : `${formatDayLabel(date)}${holiday ? `, ${holiday.name}` : ''}, ${on} on. Open in Day view`;

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
      {painting ? (
        // While a brush is active, every person gets a slot so any day can be painted.
        <div className={styles.slots}>
          {employees.map((employee, i) => (
            <MonthSlot
              key={employee.id}
              employee={employee}
              date={date}
              shifts={shifts[i]}
              timeOff={timeOff[i]}
              ctx={ctx}
            />
          ))}
        </div>
      ) : (
        <ShiftList date={date} employees={employees} shifts={shifts} ctx={ctx} />
      )}
    </div>
  );
});

/** Most entries a day lists before "+N more". */
const MAX_ENTRIES = 6;

interface ShiftListProps {
  date: ISODate;
  employees: readonly Employee[];
  shifts: readonly (readonly Shift[])[];
  ctx: BlockContext;
}

/** The day's shifts only: who works and when, in people order. */
function ShiftList({ date, employees, shifts, ctx }: ShiftListProps) {
  const entries = employees.flatMap((employee, i) => shifts[i].map((shift) => ({ employee, shift })));
  const shown = entries.length > MAX_ENTRIES ? entries.slice(0, MAX_ENTRIES - 1) : entries;
  const more = entries.length - shown.length;

  return (
    <div className={styles.entries}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map(({ employee, shift }) => {
          const color = shiftColor(shift, ctx.templates);
          const time = formatTimeRange(shift.start, shift.end, ctx.clock);
          return (
            <motion.button
              key={shift.id}
              type="button"
              className={[styles.entry, !ctx.matcher.shift(shift) && styles.entryDimmed]
                .filter(Boolean)
                .join(' ')}
              style={{ background: color, color: textOn(color) }}
              data-cell=""
              data-employee-id={employee.id}
              data-date={date}
              data-shift-id={shift.id}
              onClick={handleCellClick}
              aria-label={`${employee.name}, ${shiftName(shift, ctx.templates)}, ${time}, ${formatHours(hoursOf(shift))}`}
              title={`${employee.name}: ${shiftName(shift, ctx.templates)}, ${time}`}
              initial={isFreshShift(shift.id) ? { scale: 0.82, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', duration: 0.28, bounce: 0.4 }}
            >
              <span className={styles.entryName}>
                <span className={styles.fullName}>{employee.name}</span>
                <span className={styles.shortName}>{initials(employee.name)}</span>
              </span>
              <span className={styles.entryTime}>{time}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
      {more > 0 && (
        <button type="button" className={styles.more} onClick={() => scheduleStore.getState().openDay(date)}>
          +{more} more
        </button>
      )}
    </div>
  );
}

interface MonthSlotProps {
  employee: Employee;
  date: ISODate;
  shifts: readonly Shift[];
  timeOff: TimeOff | undefined;
  ctx: BlockContext;
}

/** One person on one day: filled when working, hatched when off, outlined otherwise. */
const MonthSlot = memo(function MonthSlot({ employee, date, shifts, timeOff, ctx }: MonthSlotProps) {
  const who = initials(employee.name);
  const first = shifts[0];
  const dimmed = first ? !shifts.some(ctx.matcher.shift) : timeOff ? !ctx.matcher.timeOff(timeOff) : false;
  const name = first ? (shifts.length > 1 ? `${shifts.length} shifts` : shiftName(first, ctx.templates)) : '';
  const label = first
    ? `${employee.name}: ${shifts.map((s) => `${shiftName(s, ctx.templates)} ${formatTimeRange(s.start, s.end, ctx.clock)}`).join(', ')}`
    : timeOff
      ? `${employee.name}: ${TIME_OFF_LABELS[timeOff.type]}`
      : `Add a shift for ${employee.name} on ${formatDayLabel(date)}`;

  return (
    <button
      type="button"
      className={[styles.slot, dimmed && styles.dimmed, first && timeOff && styles.warning]
        .filter(Boolean)
        .join(' ')}
      data-cell=""
      data-employee-id={employee.id}
      data-date={date}
      data-shift-id={first?.id}
      data-time-off-id={!first ? timeOff?.id : undefined}
      onClick={handleCellClick}
      aria-label={label}
      title={label}
    >
      <AnimatePresence initial={false}>
        {first ? (
          <motion.span
            key={shifts.map((s) => s.id).join()}
            className={styles.fill}
            initial={isFreshShift(first.id) ? { scale: 0.82, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0.4 }}
          >
            {shifts.slice(0, 2).map((shift) => {
              const color = shiftColor(shift, ctx.templates);
              return <span key={shift.id} className={styles.part} style={{ background: color }} />;
            })}
            <span className={styles.text} style={{ color: textOn(shiftColor(first, ctx.templates)) }}>
              <strong>{who}</strong>
              <span className={styles.detail}>
                {shifts.length > 1 ? name : formatTimeRange(first.start, first.end, ctx.clock)}
              </span>
            </span>
          </motion.span>
        ) : timeOff ? (
          <motion.span
            key={`off-${timeOff.type}`}
            className={styles.off}
            style={{ '--off': TIME_OFF_COLORS[timeOff.type] } as CSSProperties}
            initial={isFreshTimeOff(employee.id, date) ? { scale: 0.82, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0.4 }}
          >
            <strong>{who}</strong>
            <span className={styles.detail}>{TIME_OFF_LABELS[timeOff.type]}</span>
          </motion.span>
        ) : (
          <span key="empty" className={styles.empty}>
            {who}
          </span>
        )}
      </AnimatePresence>
    </button>
  );
});

import type { ReactNode } from 'react';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Notice } from '../components/forms';
import { Sheet } from '../components/Sheet';
import { TIME_OFF_COLORS, TIME_OFF_LABELS } from '../domain/color';
import { daysBetween } from '../domain/dates';
import { count, formatDateRange, formatDayLabel } from '../domain/format';
import { shiftColor, shiftName, shiftTags } from '../domain/shifts';
import { endsNextDay, formatHours, formatTimeRange, shiftHours } from '../domain/time';
import type { Employee, ID, Tag } from '../domain/types';
import { useScheduleStore } from '../store/useScheduleStore';
import styles from './sheets.module.css';

/*
 * What people who can only view see when they open a shift or time off: the same
 * details as the editors, without anything they could change.
 */

export function ShiftDetails({ shiftId, onClose }: { shiftId?: ID; onClose(): void }) {
  const shift = useScheduleStore((s) => (shiftId ? s.data.shifts[shiftId] : undefined));
  const templates = useScheduleStore((s) => s.data.templates);
  const tagsById = useScheduleStore((s) => s.data.tags);
  const clock = useScheduleStore((s) => s.data.settings.clock);
  const employee = useScheduleStore((s) => (shift ? s.data.employees[shift.employeeId] : undefined));
  const timeOff = useScheduleStore((s) =>
    shift
      ? Object.values(s.data.timeOff).find(
          (t) => t.employeeId === shift.employeeId && t.start <= shift.date && shift.date <= t.end,
        )
      : undefined,
  );

  if (!shift) return <Missing title="Shift not found" text="This shift was deleted." onClose={onClose} />;

  const name = shiftName(shift, templates);
  const template = shift.templateId ? templates[shift.templateId] : undefined;
  const hours = shiftHours(shift.start, shift.end, shift.breakMins);
  const tags = tagList(shiftTags(shift, templates), tagsById);

  return (
    <Sheet title="Shift" onClose={onClose} footer={<CloseFooter onClose={onClose} />}>
      <PersonLine employee={employee} />
      <dl className={styles.details}>
        <Detail label="Shift">
          <span className={styles.detailSwatch} style={{ background: shiftColor(shift, templates) }} />
          {name}
          {template && shift.label.trim() && <span className={styles.muted}> ({template.name})</span>}
        </Detail>
        <Detail label="Date">{formatDayLabel(shift.date)}</Detail>
        <Detail label="Time">
          {formatTimeRange(shift.start, shift.end, clock)}
          {endsNextDay(shift.start, shift.end) && ', ends the next day'}
        </Detail>
        <Detail label="Hours">
          {formatHours(hours)}
          {shift.breakMins > 0 && `, after a ${shift.breakMins} minute break`}
        </Detail>
        {tags.length > 0 && <Detail label="Tags">{tags.map((t) => t.name).join(', ')}</Detail>}
        {shift.note && <Detail label="Note">{shift.note}</Detail>}
      </dl>
      {timeOff && (
        <Notice tone="warning">
          {employee?.name ?? 'This person'} has {TIME_OFF_LABELS[timeOff.type].toLowerCase()} time off this
          day.
        </Notice>
      )}
    </Sheet>
  );
}

export function TimeOffDetails({ timeOffId, onClose }: { timeOffId?: ID; onClose(): void }) {
  const timeOff = useScheduleStore((s) => (timeOffId ? s.data.timeOff[timeOffId] : undefined));
  const employee = useScheduleStore((s) => (timeOff ? s.data.employees[timeOff.employeeId] : undefined));

  if (!timeOff) {
    return <Missing title="Time off not found" text="This time off was deleted." onClose={onClose} />;
  }

  const days = daysBetween(timeOff.start, timeOff.end) + 1;
  return (
    <Sheet title="Time off" onClose={onClose} footer={<CloseFooter onClose={onClose} />}>
      <PersonLine employee={employee} />
      <dl className={styles.details}>
        <Detail label="Type">
          <span className={styles.detailSwatch} style={{ background: TIME_OFF_COLORS[timeOff.type] }} />
          {TIME_OFF_LABELS[timeOff.type]}
        </Detail>
        <Detail label="Dates">
          {timeOff.start === timeOff.end
            ? formatDayLabel(timeOff.start)
            : `${formatDateRange(timeOff.start, timeOff.end)} (${count(days, 'day')})`}
        </Detail>
        {timeOff.note && <Detail label="Note">{timeOff.note}</Detail>}
      </dl>
    </Sheet>
  );
}

function PersonLine({ employee }: { employee: Employee | undefined }) {
  if (!employee) return <p className={styles.muted}>This person was removed.</p>;
  return (
    <div className={styles.detailPerson}>
      <Avatar name={employee.name} color={employee.color} />
      <strong>{employee.name}</strong>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function CloseFooter({ onClose }: { onClose(): void }) {
  return (
    <Button variant="primary" onClick={onClose}>
      Close
    </Button>
  );
}

function Missing({ title, text, onClose }: { title: string; text: string; onClose(): void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p>{text}</p>
    </Sheet>
  );
}

function tagList(ids: readonly ID[], tagsById: Readonly<Record<ID, Tag>>): Tag[] {
  return ids.map((id) => tagsById[id]).filter((tag): tag is Tag => Boolean(tag));
}

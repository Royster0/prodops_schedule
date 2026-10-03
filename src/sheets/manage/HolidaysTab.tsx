import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Field } from '../../components/forms';
import { dateRange, daysBetween, isISODate, parts, today } from '../../domain/dates';
import { count, formatDateRange, formatDayLabel } from '../../domain/format';
import {
  MAX_HOLIDAY_RANGE_DAYS,
  addCommonHolidays,
  addHolidayRange,
  groupHolidays,
  type HolidayGroup,
} from '../../domain/holidays';
import { selectHolidays } from '../../store/derived';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import styles from './manage.module.css';

/** "Thu, Nov 26, 2026" for one day, "Dec 24–Jan 1, 2026–2027 · 9 days" for a range. */
function describeGroup(group: HolidayGroup): string {
  const startYear = parts(group.start).year;
  if (group.start === group.end) return `${formatDayLabel(group.start)}, ${startYear}`;
  const endYear = parts(group.end).year;
  const years = startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`;
  return `${formatDateRange(group.start, group.end)}, ${years} · ${count(daysBetween(group.start, group.end) + 1, 'day')}`;
}

export function HolidaysTab() {
  const holidays = useScheduleStore(selectHolidays);
  const groups = useMemo(() => groupHolidays(holidays), [holidays]);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const readOnly = useScheduleStore((s) => s.readOnly);
  const { commit } = scheduleStore.getState();
  const year = parts(today()).year;

  const datesValid = isISODate(from) && isISODate(to);
  const days = datesValid && to >= from ? daysBetween(from, to) + 1 : 0;
  const taken =
    days > 0 && days <= MAX_HOLIDAY_RANGE_DAYS
      ? dateRange(from, to).filter((date) => holidays.some((h) => h.date === date)).length
      : 0;
  const newDays = days - taken;
  const error = !datesValid
    ? null
    : to < from
      ? 'The end date is before the start date. Pick a later end date.'
      : days > MAX_HOLIDAY_RANGE_DAYS
        ? 'That range is longer than a year. Pick a shorter range.'
        : newDays === 0
          ? days === 1
            ? 'There is already a holiday on that date.'
            : 'Every day in that range is already a holiday.'
          : null;
  const canAdd = name.trim() !== '' && datesValid && !error;

  const add = () => {
    if (!canAdd) return;
    const trimmed = name.trim();
    commit(
      newDays > 1 ? 'add holidays' : 'add holiday',
      (changes) => addHolidayRange(changes, trimmed, from, to),
      {
        toast: ({ added, skipped }) =>
          added > 1 || skipped > 0
            ? `Added ${trimmed} for ${count(added, 'day')}.` +
              (skipped > 0 ? ` Skipped ${count(skipped, 'day')} that already had a holiday.` : '')
            : null,
      },
    );
    setName('');
    setFrom('');
    setTo('');
  };

  const remove = (group: HolidayGroup) =>
    commit(
      group.ids.length > 1 ? 'remove holidays' : 'remove holiday',
      (changes) => group.ids.forEach((id) => changes.remove('holidays', id)),
      { toast: `Removed ${group.name}.` },
    );

  const list = (
    <ul className={styles.list}>
      {groups.length === 0 && (
        <li className={styles.empty}>
          No holidays yet. Holidays are highlighted and skipped when applying shifts.
        </li>
      )}
      {groups.map((group) => (
        <li key={group.ids[0]} className={styles.item}>
          <div className={styles.main}>
            <span className={styles.name}>{group.name}</span>
            <span className={styles.meta}>{describeGroup(group)}</span>
          </div>
          {!readOnly && (
            <Button icon="trash" iconOnly variant="ghost" size="sm" onClick={() => remove(group)}>
              Remove {group.name}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );

  if (readOnly) return list;

  return (
    <>
      <div className={styles.toolbar}>
        <Button
          icon="flag"
          onClick={() =>
            commit('add holidays', (changes) => addCommonHolidays(changes, [year, year + 1]), {
              toast: (added) =>
                added > 0
                  ? `Added ${count(added, 'holiday')}.`
                  : `The holidays for ${year} and ${year + 1} are already here.`,
            })
          }
        >
          Add common US holidays for {year} and {year + 1}
        </Button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Field label="Holiday name">
          {(id) => (
            <input
              id={id}
              value={name}
              maxLength={60}
              placeholder="e.g. Founders Day or Winter break"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <div className={styles.addRow}>
          <Field label="From">
            {(id) => (
              <input
                id={id}
                type="date"
                value={from}
                onChange={(e) => {
                  const start = e.target.value;
                  setFrom(start);
                  if (!to || to < start) setTo(start);
                }}
              />
            )}
          </Field>
          <Field label="Through">
            {(id) => (
              <input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            )}
          </Field>
          <Button type="submit" disabled={!canAdd}>
            {newDays > 1 && !error ? `Add ${count(newDays, 'day')}` : 'Add'}
          </Button>
        </div>
        {error ? (
          <p className={styles.rangeError} role="alert">
            {error}
          </p>
        ) : (
          days > 0 && (
            <p className={styles.rangeHint}>
              {days === 1 ? 'One day.' : `${count(days, 'day')}, each marked as a holiday.`}
              {taken > 0 &&
                ` ${count(taken, 'day')} ${taken === 1 ? 'is already a holiday and is' : 'are already holidays and are'} skipped.`}
            </p>
          )
        )}
      </form>

      {list}
    </>
  );
}

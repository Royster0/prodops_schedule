import { useState } from 'react';
import { Button } from '../../components/Button';
import { Field } from '../../components/forms';
import { isISODate, parts, today } from '../../domain/dates';
import { count, formatDayLabel } from '../../domain/format';
import { addCommonHolidays } from '../../domain/holidays';
import { createId } from '../../domain/ids';
import { selectHolidays } from '../../store/derived';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import styles from './manage.module.css';

export function HolidaysTab() {
  const holidays = useScheduleStore(selectHolidays);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const { commit } = scheduleStore.getState();
  const year = parts(today()).year;
  const duplicate = holidays.some((h) => h.date === date);
  const canAdd = isISODate(date) && name.trim() !== '' && !duplicate;

  const add = () => {
    if (!canAdd) return;
    commit('add holiday', (changes) => changes.put('holidays', { id: createId(), date, name: name.trim() }));
    setDate('');
    setName('');
  };

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
        className={styles.addRow}
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Field label="Holiday name" error={duplicate ? 'There is already a holiday on that date.' : null}>
          {(id) => (
            <input
              id={id}
              value={name}
              maxLength={60}
              placeholder="e.g. Founders Day"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Date">
          {(id) => <input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Button type="submit" disabled={!canAdd}>
          Add
        </Button>
      </form>

      <ul className={styles.list}>
        {holidays.length === 0 && (
          <li className={styles.empty}>
            No holidays yet. Holidays are highlighted and skipped when applying shifts.
          </li>
        )}
        {holidays.map((holiday) => (
          <li key={holiday.id} className={styles.item}>
            <div className={styles.main}>
              <span className={styles.name}>{holiday.name}</span>
              <span className={styles.meta}>
                {formatDayLabel(holiday.date)}, {parts(holiday.date).year}
              </span>
            </div>
            <Button
              icon="trash"
              iconOnly
              variant="ghost"
              size="sm"
              onClick={() =>
                commit('remove holiday', (changes) => changes.remove('holidays', holiday.id), {
                  toast: `Removed ${holiday.name}.`,
                })
              }
            >
              Remove {holiday.name}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

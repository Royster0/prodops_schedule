import { count } from '../domain/format';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { Button } from './Button';
import { Reveal } from './Reveal';
import styles from './Bars.module.css';

/** Shown while people are selected. */
export function SelectionBar() {
  const selected = useScheduleStore((s) => s.selectedIds.size);
  const isMonth = useScheduleStore((s) => s.view === 'month');
  const { openSheet, clearSelection } = scheduleStore.getState();
  return (
    <Reveal open={selected > 0}>
      <div className={styles.bar} role="status">
        <p className={styles.text}>
          <strong>{count(selected, 'person', 'people')} selected.</strong>{' '}
          {isMonth
            ? `Pick a brush and paint days for ${selected > 1 ? 'them' : 'this person'}, or tap a day to add a shift.`
            : selected > 1
              ? 'Painting a day fills it for all of them.'
              : 'Select more people to paint them together.'}
        </p>
        <div className={styles.actions}>
          <Button
            size="sm"
            icon="apply"
            onClick={() => openSheet({ kind: 'apply', preset: { who: 'selected' } })}
          >
            Apply shifts
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      </div>
    </Reveal>
  );
}

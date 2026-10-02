import { Button } from '../../components/Button';
import { describePatternTotal } from '../../domain/patterns';
import { selectPatterns } from '../../store/derived';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import { PatternPreview } from '../PatternPreview';
import styles from './manage.module.css';

export function PatternsTab() {
  const patterns = useScheduleStore(selectPatterns);
  const templates = useScheduleStore((s) => s.data.templates);
  const weekStart = useScheduleStore((s) => s.data.settings.weekStart);
  const { openSheet } = scheduleStore.getState();

  return (
    <>
      <ul className={styles.list}>
        {patterns.length === 0 && <li className={styles.empty}>No work patterns yet.</li>}
        {patterns.map((pattern) => (
          <li key={pattern.id} className={styles.patternItem}>
            <div className={styles.patternHead}>
              <div className={styles.main}>
                <span className={styles.name}>{pattern.name}</span>
                <span className={styles.meta}>{describePatternTotal(pattern, templates)}</span>
              </div>
              <div className={styles.actions}>
                <Button
                  size="sm"
                  icon="apply"
                  onClick={() =>
                    openSheet({ kind: 'apply', preset: { mode: 'pattern', patternId: pattern.id } })
                  }
                >
                  Apply
                </Button>
                <Button size="sm" onClick={() => openSheet({ kind: 'pattern', patternId: pattern.id })}>
                  Edit
                </Button>
              </div>
            </div>
            <PatternPreview pattern={pattern} templates={templates} weekStart={weekStart} />
          </li>
        ))}
      </ul>
      <Button variant="primary" icon="plus" onClick={() => openSheet({ kind: 'pattern' })}>
        New pattern
      </Button>
    </>
  );
}

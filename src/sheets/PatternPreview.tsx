import { textOn } from '../domain/color';
import { WEEKDAY_SHORT } from '../domain/dates';
import type { ID, Pattern, ShiftTemplate } from '../domain/types';
import styles from './sheets.module.css';

interface PatternPreviewProps {
  pattern: Pick<Pattern, 'length' | 'days'>;
  templates: Readonly<Record<ID, ShiftTemplate>>;
  weekStart: 0 | 1;
}

/** A color strip per week: one cell per day with the template code, or Off. */
export function PatternPreview({ pattern, templates, weekStart }: PatternPreviewProps) {
  const weeks = pattern.length === 14 ? [0, 7] : [0];
  // Days are stored Monday first; show them in the configured week order.
  const order = weekStart === 1 ? [0, 1, 2, 3, 4, 5, 6] : [6, 0, 1, 2, 3, 4, 5];
  return (
    <div className={styles.preview} aria-label="Pattern preview">
      {weeks.map((offset) => (
        <div key={offset} className={styles.previewWeek}>
          {weeks.length > 1 && (
            <span className={styles.previewLabel}>{offset === 0 ? 'Week A' : 'Week B'}</span>
          )}
          <div className={styles.previewDays}>
            {order.map((i) => {
              const template = templates[pattern.days[offset + i]];
              return (
                <div key={i} className={styles.previewDay}>
                  <span className={styles.previewWeekday}>{WEEKDAY_SHORT[(i + 1) % 7]}</span>
                  <span
                    className={template ? styles.previewBar : styles.previewOff}
                    style={
                      template ? { background: template.color, color: textOn(template.color) } : undefined
                    }
                    title={template?.name ?? 'Off'}
                  >
                    {template ? template.code : 'Off'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

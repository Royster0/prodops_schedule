import { Button } from '../../components/Button';
import { textOn } from '../../domain/color';
import { moveInOrder } from '../../domain/manage';
import { formatHours, formatTimeRange, shiftHours } from '../../domain/time';
import { selectTemplates } from '../../store/derived';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import styles from './manage.module.css';

export function TemplatesTab() {
  const templates = useScheduleStore(selectTemplates);
  const clock = useScheduleStore((s) => s.data.settings.clock);
  const readOnly = useScheduleStore((s) => s.readOnly);
  const { commit, openSheet } = scheduleStore.getState();

  return (
    <>
      <ul className={styles.list}>
        {templates.length === 0 && <li className={styles.empty}>No shift templates yet.</li>}
        {templates.map((template, index) => (
          <li key={template.id} className={styles.item}>
            <span
              className={styles.swatch}
              style={{ background: template.color, color: textOn(template.color) }}
            >
              {template.code}
            </span>
            <div className={styles.main}>
              <span className={styles.name}>{template.name}</span>
              <span className={styles.meta}>
                {formatTimeRange(template.start, template.end, clock)} ·{' '}
                {formatHours(shiftHours(template.start, template.end, template.breakMins))}
                {template.breakMins > 0 ? `, ${template.breakMins} min break` : ''}
              </span>
            </div>
            {!readOnly && (
              <div className={styles.actions}>
                <Button
                  icon="arrowUp"
                  iconOnly
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() =>
                    commit('reorder templates', (c) => moveInOrder(c, 'templates', template.id, -1))
                  }
                >
                  Move {template.name} up
                </Button>
                <Button
                  icon="arrowDown"
                  iconOnly
                  variant="ghost"
                  size="sm"
                  disabled={index === templates.length - 1}
                  onClick={() =>
                    commit('reorder templates', (c) => moveInOrder(c, 'templates', template.id, 1))
                  }
                >
                  Move {template.name} down
                </Button>
                <Button size="sm" onClick={() => openSheet({ kind: 'template', templateId: template.id })}>
                  Edit
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <Button variant="primary" icon="plus" onClick={() => openSheet({ kind: 'template' })}>
          New template
        </Button>
      )}
    </>
  );
}

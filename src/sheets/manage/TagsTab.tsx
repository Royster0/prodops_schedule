import { Button } from '../../components/Button';
import { count } from '../../domain/format';
import { selectEmployees, selectTags } from '../../store/derived';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import styles from './manage.module.css';

export function TagsTab() {
  const tags = useScheduleStore(selectTags);
  const employees = useScheduleStore(selectEmployees);
  const { openSheet } = scheduleStore.getState();

  return (
    <>
      <ul className={styles.list}>
        {tags.length === 0 && <li className={styles.empty}>No tags yet.</li>}
        {tags.map((tag) => {
          const people = employees.filter((e) => e.tags.includes(tag.id)).length;
          return (
            <li key={tag.id} className={styles.item}>
              <span className={styles.tagSquare} style={{ background: tag.color }} aria-hidden="true" />
              <div className={styles.main}>
                <span className={styles.name}>{tag.name}</span>
                <span className={styles.meta}>{count(people, 'person', 'people')}</span>
              </div>
              <div className={styles.actions}>
                <Button size="sm" onClick={() => openSheet({ kind: 'tag', tagId: tag.id })}>
                  Edit
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="primary" icon="plus" onClick={() => openSheet({ kind: 'tag' })}>
        New tag
      </Button>
    </>
  );
}

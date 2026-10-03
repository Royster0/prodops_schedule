import { memo } from 'react';
import { Avatar } from '../components/Avatar';
import { MenuButton, type MenuEntry } from '../components/Menu';
import { count } from '../domain/format';
import { formatHours } from '../domain/time';
import type { Employee, ID, Tag } from '../domain/types';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './RowHeader.module.css';

interface RowHeaderProps {
  employee: Employee;
  tagsById: Readonly<Record<ID, Tag>>;
  selected: boolean;
  hours: number;
  days: number;
  /** Day view shows hours only. */
  showDays?: boolean;
}

function personMenu(employee: Employee): MenuEntry[] {
  const { openSheet, toggleSelected, setFilters, selectedIds, readOnly } = scheduleStore.getState();
  const showOnly: MenuEntry = {
    label: 'Show only this person',
    icon: 'filter',
    onSelect: () => setFilters({ people: [employee.id] }),
  };
  if (readOnly) return [showOnly];
  return [
    {
      label: 'Edit person',
      icon: 'people',
      onSelect: () => openSheet({ kind: 'person', employeeId: employee.id }),
    },
    {
      label: 'Set a work pattern…',
      icon: 'calendar',
      onSelect: () =>
        openSheet({ kind: 'apply', preset: { mode: 'pattern', who: 'one', employeeId: employee.id } }),
    },
    {
      label: 'Add a one-off shift…',
      icon: 'plus',
      onSelect: () => openSheet({ kind: 'shift', employeeId: employee.id }),
    },
    {
      label: 'Add time off…',
      icon: 'timeOff',
      onSelect: () => openSheet({ kind: 'timeOff', employeeId: employee.id }),
    },
    'divider',
    {
      label: selectedIds.has(employee.id) ? 'Unselect' : 'Select',
      icon: 'check',
      onSelect: () => toggleSelected(employee.id),
    },
    showOnly,
  ];
}

/** Sticky row header: avatar (toggles selection), name (opens a menu), hours, days and tags. */
export const RowHeader = memo(function RowHeader({
  employee,
  tagsById,
  selected,
  hours,
  days,
  showDays = true,
}: RowHeaderProps) {
  const tags = employee.tags.map((id) => tagsById[id]).filter((tag): tag is Tag => Boolean(tag));
  const readOnly = useScheduleStore((s) => s.readOnly);
  return (
    <div className={styles.header}>
      {readOnly ? (
        <span className={styles.avatarButton}>
          <Avatar name={employee.name} color={employee.color} />
        </span>
      ) : (
        <button
          type="button"
          className={styles.avatarButton}
          aria-pressed={selected}
          aria-label={`Select ${employee.name}`}
          onClick={() => scheduleStore.getState().toggleSelected(employee.id)}
        >
          <Avatar name={employee.name} color={employee.color} selected={selected} />
        </button>
      )}
      <div className={styles.text}>
        <MenuButton
          label={`${employee.name} options`}
          entries={() => personMenu(employee)}
          align="start"
          variant="ghost"
          className={styles.name}
        >
          {employee.name}
        </MenuButton>
        <span className={styles.meta}>
          {formatHours(hours)}
          {showDays && <> · {count(days, 'day')}</>}
        </span>
        {tags.length > 0 && (
          <span className={styles.tags}>
            {tags.map((tag) => (
              <span key={tag.id} className={styles.tag}>
                <span className={styles.tagDot} style={{ background: tag.color }} aria-hidden="true" />
                {tag.name}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
});

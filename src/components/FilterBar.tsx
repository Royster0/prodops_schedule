import { TIME_OFF_COLORS } from '../domain/color';
import { activeFilterCount } from '../domain/filters';
import { selectEmployees, selectTags, selectTemplates } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { Button } from './Button';
import { Checklist } from './Checklist';
import styles from './FilterBar.module.css';
import { Checkbox } from './forms';
import { Icon } from './Icon';
import { Reveal } from './Reveal';

/** Search plus People, Tags and Shift types checklists. */
export function FilterBar() {
  const open = useScheduleStore((s) => s.filterBarOpen);
  const filters = useScheduleStore((s) => s.filters);
  const employees = useScheduleStore(selectEmployees);
  const tags = useScheduleStore(selectTags);
  const templates = useScheduleStore(selectTemplates);
  const { setFilters, clearFilters } = scheduleStore.getState();
  const active = activeFilterCount(filters);

  return (
    <Reveal open={open}>
      <div className={styles.bar} role="search">
        <label className={styles.search}>
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Find a person"
            aria-label="Find a person"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </label>
        <Checklist
          label="People"
          options={employees.map((e) => ({ id: e.id, label: e.name, color: e.color }))}
          selected={filters.people}
          onChange={(people) => setFilters({ people })}
          empty="No people yet."
        />
        <Checklist
          label="Tags"
          options={tags.map((t) => ({ id: t.id, label: t.name, color: t.color }))}
          selected={filters.tags}
          onChange={(ids) => setFilters({ tags: ids })}
          empty="No tags yet."
        />
        <Checklist
          label="Shift types"
          options={[
            ...templates.map((t) => ({ id: t.id, label: t.name, color: t.color })),
            { id: 'custom', label: 'One-off shifts', color: 'var(--muted)' },
            { id: 'off', label: 'Time off', color: TIME_OFF_COLORS.vacation, hatch: true },
          ]}
          selected={filters.kinds}
          onChange={(kinds) => setFilters({ kinds })}
        />
        <div className={styles.hide}>
          <Checkbox
            label="Hide people with no matches"
            checked={filters.hideEmpty}
            onChange={(hideEmpty) => setFilters({ hideEmpty })}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={clearFilters} disabled={active === 0}>
          Clear filters
        </Button>
      </div>
    </Reveal>
  );
}

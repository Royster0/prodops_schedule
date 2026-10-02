import { activeFilterCount } from '../domain/filters';
import { COPY_OFFSET_DAYS, VIEW_LABELS, periodLabel } from '../domain/period';
import type { ViewMode } from '../domain/types';
import { NARROW, TINY, useMediaQuery } from '../hooks/useMediaQuery';
import { selectPeriod } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { copyPreviousPeriod, clearShownShifts } from '../store/boardActions';
import { Button } from './Button';
import styles from './Header.module.css';
import { MenuButton, type MenuEntry } from './Menu';
import { Segmented } from './Segmented';

const VIEW_OPTIONS = (['day', 'week', 'twoWeeks', 'month'] as const).map((value) => ({
  value,
  label: VIEW_LABELS[value],
}));

const COPY_LABELS: Partial<Record<ViewMode, string>> = {
  day: 'Copy same day last week',
  week: 'Copy last week here',
  twoWeeks: 'Copy the previous 2 weeks here',
};

export function Header() {
  const title = useScheduleStore((s) => s.data.settings.title);
  const view = useScheduleStore((s) => s.view);
  const period = useScheduleStore(selectPeriod);
  const filterCount = useScheduleStore((s) => activeFilterCount(s.filters));
  const filterBarOpen = useScheduleStore((s) => s.filterBarOpen);
  const narrow = useMediaQuery(NARROW);
  const tiny = useMediaQuery(TINY);
  const { goPrev, goNext, goToday, setView, openSheet, setFilterBarOpen } = scheduleStore.getState();

  const moreEntries = (): MenuEntry[] => [
    {
      label: 'Manage people and shifts',
      icon: 'people',
      onSelect: () => openSheet({ kind: 'manage', tab: 'people' }),
    },
    { label: 'Add time off…', icon: 'timeOff', onSelect: () => openSheet({ kind: 'timeOff' }) },
    ...(COPY_OFFSET_DAYS[view]
      ? [{ label: COPY_LABELS[view]!, icon: 'copy' as const, onSelect: copyPreviousPeriod }]
      : []),
    { label: 'Clear the shifts shown', icon: 'trash', danger: true, onSelect: clearShownShifts },
    'divider',
    { label: 'Holidays', icon: 'flag', onSelect: () => openSheet({ kind: 'manage', tab: 'holidays' }) },
    { label: 'Settings', icon: 'settings', onSelect: () => openSheet({ kind: 'manage', tab: 'settings' }) },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>
          <button
            type="button"
            className={styles.titleButton}
            onClick={() => openSheet({ kind: 'manage', tab: 'settings' })}
            title="Schedule settings"
          >
            {title}
          </button>
        </h1>
        <SaveStatus />
      </div>

      <div className={styles.navRow}>
        <nav className={styles.nav} aria-label="Dates">
          <Button icon="chevronLeft" iconOnly variant="ghost" onClick={goPrev} title="Previous (←)">
            Previous
          </Button>
          <Button icon="chevronRight" iconOnly variant="ghost" onClick={goNext} title="Next (→)">
            Next
          </Button>
          <h2 className={styles.range} aria-live="polite">
            {periodLabel(period)}
          </h2>
          <Button size={narrow ? 'sm' : 'md'} onClick={goToday} title="Today (T)">
            Today
          </Button>
        </nav>

        <div className={styles.views}>
          {tiny ? (
            <ViewMenu view={view} onChange={setView} />
          ) : (
            <Segmented
              label="View"
              options={VIEW_OPTIONS}
              value={view}
              onChange={setView}
              size={narrow ? 'sm' : 'md'}
            />
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          icon="filter"
          collapseLabel
          aria-pressed={filterBarOpen}
          badge={filterCount > 0 ? filterCount : null}
          onClick={() => setFilterBarOpen(!filterBarOpen)}
        >
          Filter
        </Button>
        <Button icon="apply" collapseLabel onClick={() => openSheet({ kind: 'apply' })}>
          Apply shifts
        </Button>
        <Button icon="plus" variant="primary" collapseLabel onClick={() => openSheet({ kind: 'shift' })}>
          Add shift
        </Button>
        <MenuButton label="More" icon="more" iconOnly entries={moreEntries} />
      </div>
    </header>
  );
}

function SaveStatus() {
  const saveState = useScheduleStore((s) => s.saveState);
  const savedLabel = useScheduleStore((s) => s.savedLabel);
  const text =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'error'
        ? "Couldn't save. Storage may be full."
        : savedLabel;
  return (
    <span
      className={[styles.status, saveState === 'error' && styles.statusError].filter(Boolean).join(' ')}
      role="status"
    >
      <span className={styles.statusDot} data-state={saveState} aria-hidden="true" />
      <span className={styles.statusText}>{text}</span>
    </span>
  );
}

function ViewMenu({ view, onChange }: { view: ViewMode; onChange(view: ViewMode): void }) {
  const entries = VIEW_OPTIONS.map((option) => ({
    label: option.label,
    checked: option.value === view,
    onSelect: () => onChange(option.value),
  }));
  return (
    <MenuButton label="View" entries={entries}>
      {`${VIEW_LABELS[view]} ▾`}
    </MenuButton>
  );
}

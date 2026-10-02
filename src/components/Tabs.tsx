import { motion } from 'motion/react';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import styles from './Tabs.module.css';

interface TabsProps<T extends string> {
  label: string;
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
  /** Id prefix shared with the tab panel, for aria-controls. */
  idPrefix: string;
}

/** A scrollable tab list. The underline slides to the selected tab. */
export function Tabs<T extends string>({ label, tabs, value, onChange, idPrefix }: TabsProps<T>) {
  const layoutId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected tab visible when the row scrolls on narrow screens.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((t) => t.value === value);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.value);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#${CSS.escape(`${idPrefix}-tab-${next.value}`)}`)
      ?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${idPrefix}-tab-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {selected && <motion.span layoutId={layoutId} className={styles.underline} />}
          </button>
        );
      })}
    </div>
  );
}

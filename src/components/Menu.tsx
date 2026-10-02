import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './Menu.module.css';
import { Popover } from './Popover';

export type MenuEntry =
  | {
      label: string;
      icon?: IconName;
      onSelect(): void;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
    }
  | 'divider';

interface MenuListProps {
  entries: readonly MenuEntry[];
  onDone(): void;
}

/** Menu items with arrow key navigation. */
export function MenuList({ entries, onDone }: MenuListProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Tab') onDone();
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  };

  return (
    <div className={styles.list} onKeyDown={onKeyDown}>
      {entries.map((entry, i) =>
        entry === 'divider' ? (
          <div key={`divider-${i}`} className={styles.divider} role="separator" />
        ) : (
          <button
            key={entry.label}
            type="button"
            role={entry.checked === undefined ? 'menuitem' : 'menuitemradio'}
            aria-checked={entry.checked}
            disabled={entry.disabled}
            className={[styles.item, entry.danger && styles.danger].filter(Boolean).join(' ')}
            onClick={() => {
              onDone();
              entry.onSelect();
            }}
          >
            {entry.icon ? <Icon name={entry.icon} size={17} /> : <span className={styles.iconSpace} />}
            <span className={styles.label}>{entry.label}</span>
            {entry.checked && <Icon name="check" size={16} className={styles.check} />}
          </button>
        ),
      )}
    </div>
  );
}

interface MenuButtonProps {
  label: string;
  entries: readonly MenuEntry[] | (() => readonly MenuEntry[]);
  icon?: IconName;
  iconOnly?: boolean;
  collapseLabel?: boolean;
  align?: 'start' | 'end';
  variant?: 'default' | 'ghost';
  children?: ReactNode;
  className?: string;
}

/** A button that opens a menu. */
export function MenuButton({
  label,
  entries,
  icon,
  iconOnly,
  collapseLabel,
  align = 'end',
  variant = 'default',
  children,
  className,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  return (
    <>
      <Button
        ref={anchorRef}
        icon={icon}
        iconOnly={iconOnly}
        collapseLabel={collapseLabel}
        variant={variant}
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {children ?? label}
      </Button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} align={align} role="menu" label={label}>
        <MenuList entries={typeof entries === 'function' ? entries() : entries} onDone={close} />
      </Popover>
    </>
  );
}

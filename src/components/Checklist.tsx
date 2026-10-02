import { useRef, useState, type CSSProperties } from 'react';
import type { ID } from '../domain/types';
import { Button } from './Button';
import styles from './Checklist.module.css';
import { Popover } from './Popover';

export interface ChecklistOption {
  id: ID;
  label: string;
  color?: string;
  hatch?: boolean;
}

interface ChecklistProps {
  label: string;
  options: readonly ChecklistOption[];
  selected: readonly ID[];
  onChange(selected: ID[]): void;
  empty?: string;
}

/** A dropdown button with a list of checkboxes, used by the filter bar. */
export function Checklist({
  label,
  options,
  selected,
  onChange,
  empty = 'Nothing to pick yet.',
}: ChecklistProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const toggle = (id: ID) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <>
      <Button
        ref={anchorRef}
        size="sm"
        iconAfter="chevronDown"
        aria-haspopup="dialog"
        aria-expanded={open}
        badge={selected.length > 0 ? selected.length : null}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="dialog" label={label}>
        <div className={styles.list} role="group" aria-label={label}>
          {options.length === 0 && <p className={styles.empty}>{empty}</p>}
          {options.map((option) => (
            <label key={option.id} className={styles.item}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => toggle(option.id)}
              />
              {option.color && (
                <span
                  className={option.hatch ? styles.hatch : styles.swatch}
                  style={{ '--swatch': option.color } as CSSProperties}
                  aria-hidden="true"
                />
              )}
              <span className={styles.text}>{option.label}</span>
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <button type="button" className={styles.clear} onClick={() => onChange([])}>
            Clear {label.toLowerCase()}
          </button>
        )}
      </Popover>
    </>
  );
}

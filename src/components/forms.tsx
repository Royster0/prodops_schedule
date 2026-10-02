import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { PALETTE, textOn } from '../domain/color';
import type { ID, Tag } from '../domain/types';
import { Button } from './Button';
import { Icon } from './Icon';
import styles from './forms.module.css';

/** Form building blocks shared by every sheet. */

interface FieldProps {
  label: string;
  children: (id: string) => ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

/** A labeled control. The render prop receives the id to put on the control. */
export function Field({ label, children, hint, error, className }: FieldProps) {
  const id = useId();
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </div>
  );
}

/** A group label for controls that are not a single input. */
export function Group({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')} role="group" aria-labelledby={id}>
      <span id={id} className={styles.label}>
        {label}
      </span>
      {children}
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** A small color mark before the label. */
  color?: string;
  hatch?: boolean;
}

interface ChoiceChipsProps<T extends string> {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange(value: T): void;
}

/** Single choice drawn as wrapping chips. */
export function ChoiceChips<T extends string>({ label, choices, value, onChange }: ChoiceChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.chips}>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="radio"
          aria-checked={choice.value === value}
          className={styles.chip}
          onClick={() => onChange(choice.value)}
        >
          {choice.color && (
            <span
              className={choice.hatch ? styles.chipHatch : styles.chipDot}
              style={{ '--chip': choice.color } as CSSProperties}
              aria-hidden="true"
            />
          )}
          {choice.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleChipsProps {
  label: string;
  options: readonly { id: ID; label: string; color?: string }[];
  selected: readonly ID[];
  onChange(selected: ID[]): void;
  empty?: ReactNode;
}

/** Multiple choice chips, e.g. tags or weekdays. */
export function ToggleChips({ label, options, selected, onChange, empty }: ToggleChipsProps) {
  if (options.length === 0) return <p className={styles.hint}>{empty}</p>;
  return (
    <div role="group" aria-label={label} className={styles.chips}>
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            className={styles.chip}
            onClick={() =>
              onChange(on ? selected.filter((id) => id !== option.id) : [...selected, option.id])
            }
          >
            {option.color && (
              <span className={styles.chipSquare} style={{ background: option.color }} aria-hidden="true" />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function TagToggles({
  tags,
  selected,
  onChange,
}: {
  tags: readonly Tag[];
  selected: readonly ID[];
  onChange(selected: ID[]): void;
}) {
  return (
    <ToggleChips
      label="Tags"
      options={tags.map((t) => ({ id: t.id, label: t.name, color: t.color }))}
      selected={selected}
      onChange={onChange}
      empty="No tags yet. Add them under Manage, Tags."
    />
  );
}

interface ColorSwatchesProps {
  label: string;
  value: string;
  onChange(color: string): void;
}

export function ColorSwatches({ label, value, onChange }: ColorSwatchesProps) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.swatches}>
      {PALETTE.map((color) => {
        const selected = color.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            className={styles.swatch}
            style={{ background: color, color: textOn(color) }}
            onClick={() => onChange(color)}
          >
            {selected && <Icon name="check" size={16} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

interface CheckboxProps {
  label: ReactNode;
  checked: boolean;
  onChange(checked: boolean): void;
  hint?: ReactNode;
}

export function Checkbox({ label, checked, onChange, hint }: CheckboxProps) {
  const id = useId();
  return (
    <div className={styles.checkbox}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        {label}
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
    </div>
  );
}

/** A delete button that needs two taps: the first turns it red and asks again. */
export function ConfirmDeleteButton({ onConfirm, label = 'Delete' }: { onConfirm(): void; label?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      variant={armed ? 'dangerSolid' : 'danger'}
      icon="trash"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Tap again to delete' : label}
    </Button>
  );
}

/** Pushes the following footer buttons to the right. */
export function Spacer() {
  return <span className={styles.spacer} />;
}

/** An inline note, e.g. a warning about time off. */
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <p className={[styles.notice, tone === 'warning' && styles.warning].filter(Boolean).join(' ')}>
      {tone === 'warning' && <Icon name="warning" size={16} />}
      <span>{children}</span>
    </p>
  );
}

/** A live line under a group of fields, e.g. "8h scheduled, ends the next day". */
export function Summary({ children }: { children: ReactNode }) {
  return (
    <p className={styles.summary} aria-live="polite">
      {children}
    </p>
  );
}

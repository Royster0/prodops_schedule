import { motion } from 'motion/react';
import { useId } from 'react';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
  size?: 'sm' | 'md';
  stretch?: boolean;
}

/** A radio group drawn as connected buttons. The selected background slides between options. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  stretch = false,
}: SegmentedProps<T>) {
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={[styles.group, size === 'sm' && styles.small, stretch && styles.stretch]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={styles.option}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const index = options.findIndex((o) => o.value === value);
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              event.stopPropagation();
              const next = options[(index + step + options.length) % options.length];
              onChange(next.value);
              const buttons = event.currentTarget.parentElement?.querySelectorAll('button');
              buttons?.[options.indexOf(next)]?.focus();
            }}
            tabIndex={selected ? 0 : -1}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className={styles.thumb}
                transition={{ type: 'spring', bounce: 0.18, duration: 0.32 }}
              />
            )}
            <span className={styles.text}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

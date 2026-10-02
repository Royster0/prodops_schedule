import { motion } from 'motion/react';
import { memo, type CSSProperties, type MouseEventHandler } from 'react';
import { TIME_OFF_COLORS, TIME_OFF_LABELS } from '../domain/color';
import type { ISODate, TimeOff } from '../domain/types';
import { isFreshTimeOff } from '../store/freshness';
import styles from './TimeOffBlock.module.css';

interface TimeOffBlockProps {
  timeOff: TimeOff;
  /** The date this block shows, so painting a day animates just that day. */
  date: ISODate;
  compact?: boolean;
  dimmed?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/** Diagonal hatching in the time off type's color, labeled with the type. */
export const TimeOffBlock = memo(function TimeOffBlock({
  timeOff,
  date,
  compact = false,
  dimmed = false,
  onClick,
}: TimeOffBlockProps) {
  const label = TIME_OFF_LABELS[timeOff.type];
  return (
    <motion.button
      type="button"
      data-time-off-id={timeOff.id}
      className={[styles.block, compact && styles.compact, dimmed && styles.dimmed].filter(Boolean).join(' ')}
      style={{ '--off': TIME_OFF_COLORS[timeOff.type] } as CSSProperties}
      initial={isFreshTimeOff(timeOff.employeeId, date) ? { scale: 0.82, opacity: 0 } : false}
      animate={{ scale: 1, opacity: dimmed ? 0.18 : 1 }}
      exit={{ scale: 0.85, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', duration: 0.28, bounce: 0.4 }}
      onClick={onClick}
      aria-label={`${label} time off${timeOff.note ? `: ${timeOff.note}` : ''}`}
    >
      <span className={styles.label}>{compact ? label.slice(0, 3) : label}</span>
      {!compact && timeOff.note && <span className={styles.note}>{timeOff.note}</span>}
    </motion.button>
  );
});

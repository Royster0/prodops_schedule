import { motion } from 'motion/react';
import { memo, type CSSProperties, type MouseEventHandler } from 'react';
import { textOn } from '../domain/color';
import { shiftColor, shiftName, type TemplateLookup } from '../domain/shifts';
import { formatTimeRange, type Clock } from '../domain/time';
import type { Shift } from '../domain/types';
import { isFreshShift } from '../store/freshness';
import styles from './ShiftBar.module.css';

interface ShiftBarProps {
  shift: Shift;
  templates: TemplateLookup;
  clock: Clock;
  /** Position within the lane, as fractions of its width. */
  left: number;
  width: number;
  /** Which slice of the lane height this bar uses when shifts share a lane. */
  lane: number;
  lanes: number;
  dimmed?: boolean;
  warning?: boolean;
  /** Overnight spillover from the previous day, drawn faded from the left edge. */
  spillover?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/** A shift on the Day view timeline. */
export const ShiftBar = memo(function ShiftBar({
  shift,
  templates,
  clock,
  left,
  width,
  lane,
  lanes,
  dimmed = false,
  warning = false,
  spillover = false,
  onClick,
}: ShiftBarProps) {
  const color = shiftColor(shift, templates);
  const name = shiftName(shift, templates);
  const time = formatTimeRange(shift.start, shift.end, clock);
  const style = {
    left: `${left * 100}%`,
    width: `${width * 100}%`,
    top: `calc(${(lane / lanes) * 100}% + 4px)`,
    height: `calc(${100 / lanes}% - 8px)`,
    background: color,
    color: textOn(color),
  } as CSSProperties;

  return (
    <motion.button
      type="button"
      data-shift-id={shift.id}
      className={[
        styles.bar,
        spillover && styles.spillover,
        dimmed && styles.dimmed,
        warning && styles.warning,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      initial={!spillover && isFreshShift(shift.id) ? { scale: 0.82, opacity: 0 } : false}
      animate={{ scale: 1, opacity: dimmed ? 0.18 : spillover ? 0.55 : 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', duration: 0.28, bounce: 0.35 }}
      onClick={onClick}
      aria-label={`${spillover ? 'From yesterday: ' : ''}${name}, ${time}${warning ? ', conflict' : ''}`}
    >
      <span className={styles.name}>{name}</span>
      <span className={styles.time}>{time}</span>
    </motion.button>
  );
});

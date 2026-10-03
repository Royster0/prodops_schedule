import { motion } from 'motion/react';
import { memo, type MouseEventHandler } from 'react';
import { textOn } from '../domain/color';
import { trackPosition } from '../domain/coverage';
import { shiftCode, shiftColor, shiftName, shiftTags, type TemplateLookup } from '../domain/shifts';
import { formatTime, formatTimeRange, type Clock } from '../domain/time';
import type { ID, Shift, Tag } from '../domain/types';
import { isFreshShift } from '../store/freshness';
import styles from './ShiftBlock.module.css';

export interface ShiftBlockProps {
  shift: Shift;
  templates: TemplateLookup;
  tags: Readonly<Record<ID, Tag>>;
  clock: Clock;
  dayStart: number;
  dayEnd: number;
  compact?: boolean;
  dimmed?: boolean;
  warning?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * The signature element: a solid block in the shift color with its name, times
 * and a time track showing where the shift sits within the day.
 */
export const ShiftBlock = memo(function ShiftBlock({
  shift,
  templates,
  tags,
  clock,
  dayStart,
  dayEnd,
  compact = false,
  dimmed = false,
  warning = false,
  onClick,
}: ShiftBlockProps) {
  const color = shiftColor(shift, templates);
  const name = shiftName(shift, templates);
  const track = trackPosition(shift.start, shift.end, dayStart, dayEnd);
  const tagColors = shiftTags(shift, templates)
    .map((id) => tags[id]?.color)
    .filter(Boolean);

  return (
    <motion.button
      type="button"
      data-shift-id={shift.id}
      className={[styles.block, compact && styles.compact, dimmed && styles.dimmed, warning && styles.warning]
        .filter(Boolean)
        .join(' ')}
      style={{ background: color, color: textOn(color) }}
      initial={isFreshShift(shift.id) ? { scale: 0.82, opacity: 0 } : false}
      animate={{ scale: 1, opacity: dimmed ? 0.18 : 1 }}
      exit={{ scale: 0.85, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', duration: 0.28, bounce: 0.4 }}
      onClick={onClick}
      aria-label={`${name}, ${formatTimeRange(shift.start, shift.end, clock)}${warning ? ', conflict' : ''}`}
    >
      <span className={styles.top}>
        <span className={styles.name}>{compact ? shiftCode(shift, templates) : name}</span>
        {(tagColors.length > 0 || shift.note) && (
          <span className={styles.marks} aria-hidden="true">
            {tagColors.map((tagColor, i) => (
              <span key={i} className={styles.tagDot} style={{ background: tagColor }} />
            ))}
            {shift.note && <span className={styles.noteDot} />}
          </span>
        )}
      </span>
      <span className={styles.time}>
        {/* Narrow blocks put the end time on its own line rather than cut it off. */}
        {formatTime(shift.start, clock)}–<wbr />
        {formatTime(shift.end, clock)}
      </span>
      <span className={styles.track} aria-hidden="true">
        <span
          className={styles.segment}
          style={{ left: `${track.left * 100}%`, width: `${Math.max(track.width * 100, 4)}%` }}
        />
      </span>
    </motion.button>
  );
});

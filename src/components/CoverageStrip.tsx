import { memo } from 'react';
import { formatHour, type Clock } from '../domain/time';
import styles from './CoverageStrip.module.css';

interface CoverageStripProps {
  /** People working each hour. */
  counts: readonly number[];
  fromHour: number;
  /** "N on" for the day. */
  total: number;
  /** Bars scale against this, usually the number of people shown. */
  max: number;
  clock: Clock;
}

/** One tiny bar per hour sized by headcount, plus "N on". */
export const CoverageStrip = memo(function CoverageStrip({
  counts,
  fromHour,
  total,
  max,
  clock,
}: CoverageStripProps) {
  const scale = Math.max(max, 1);
  return (
    <span className={styles.strip}>
      <span className={styles.bars} aria-hidden="true">
        {counts.map((n, i) => (
          <span
            key={i}
            className={n === 0 ? styles.empty : styles.bar}
            style={{ height: n === 0 ? undefined : `${Math.max(18, (n / scale) * 100)}%` }}
            title={`${formatHour(fromHour + i, clock)}: ${n} on`}
          />
        ))}
      </span>
      <span className={styles.total}>{total} on</span>
    </span>
  );
});

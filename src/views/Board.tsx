import { motion } from 'motion/react';
import { useRef } from 'react';
import { usePaintStroke } from '../hooks/usePaintStroke';
import { selectEmployees, selectPeriod } from '../store/derived';
import { useScheduleStore } from '../store/useScheduleStore';
import styles from './Board.module.css';
import { DayView } from './DayView';
import { EmptyState } from './EmptyState';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';

/** The scrolling board. Shows the active view and handles paint strokes. */
export function Board() {
  const view = useScheduleStore((s) => s.view);
  const periodStart = useScheduleStore((s) => selectPeriod(s).start);
  const painting = useScheduleStore((s) => s.tool.kind !== 'select');
  const hasPeople = useScheduleStore((s) => selectEmployees(s).length > 0);
  const boardRef = useRef<HTMLDivElement>(null);
  usePaintStroke(boardRef);

  return (
    <div
      ref={boardRef}
      className={[styles.board, painting && styles.painting].filter(Boolean).join(' ')}
      data-view={view}
      data-painting={painting || undefined}
    >
      <motion.div
        key={hasPeople ? `${view}:${periodStart}` : 'empty'}
        className={styles.content}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.14 }}
      >
        {!hasPeople && <EmptyState />}
        {hasPeople && view === 'day' && <DayView />}
        {hasPeople && (view === 'week' || view === 'twoWeeks') && <WeekView compact={view === 'twoWeeks'} />}
        {hasPeople && view === 'month' && <MonthView />}
      </motion.div>
    </div>
  );
}

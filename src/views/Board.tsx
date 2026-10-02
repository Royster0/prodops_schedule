import { motion } from 'motion/react';
import { useRef } from 'react';
import { usePaintStroke } from '../hooks/usePaintStroke';
import { selectPeriod } from '../store/derived';
import { useScheduleStore } from '../store/useScheduleStore';
import styles from './Board.module.css';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';

/** The scrolling board. Shows the active view and handles paint strokes. */
export function Board() {
  const view = useScheduleStore((s) => s.view);
  const periodStart = useScheduleStore((s) => selectPeriod(s).start);
  const painting = useScheduleStore((s) => s.tool.kind !== 'select');
  const boardRef = useRef<HTMLDivElement>(null);
  usePaintStroke(boardRef);

  return (
    <div
      ref={boardRef}
      className={[styles.board, painting && styles.painting].filter(Boolean).join(' ')}
      data-view={view}
    >
      <motion.div
        key={`${view}:${periodStart}`}
        className={styles.content}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.14 }}
      >
        {view === 'day' && <DayView />}
        {(view === 'week' || view === 'twoWeeks') && <WeekView compact={view === 'twoWeeks'} />}
        {view === 'month' && <MonthView />}
      </motion.div>
    </div>
  );
}

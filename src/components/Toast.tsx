import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './Toast.module.css';

const TOAST_MS = 5500;

/** One toast at a time, above the dock and hint bar. */
export function Toast() {
  const toast = useScheduleStore((s) => s.toast);
  const { dismissToast, undo } = scheduleStore.getState();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  return (
    <div className={styles.region} aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            className={styles.toast}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.message}>{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                className={styles.undo}
                onClick={() => {
                  dismissToast();
                  undo();
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

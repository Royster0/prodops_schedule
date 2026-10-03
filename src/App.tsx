import { MotionConfig } from 'motion/react';
import styles from './App.module.css';
import { Dock } from './components/Dock';
import { FilterBar } from './components/FilterBar';
import { Header } from './components/Header';
import { HintBar } from './components/HintBar';
import { SelectionBar } from './components/SelectionBar';
import { Toast } from './components/Toast';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useScheduleStore } from './store/useScheduleStore';
import { SheetHost } from './sheets/SheetHost';
import { Board } from './views/Board';
import { Button } from './components/Button';

export default function App() {
  useAppLifecycle();
  useKeyboardShortcuts();
  const status = useScheduleStore((s) => s.status);
  const loadError = useScheduleStore((s) => s.loadError);
  // Viewers get the schedule without the painting tools.
  const readOnly = useScheduleStore((s) => s.readOnly);

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.app}>
        <Header />
        <FilterBar />
        <SelectionBar />
        <main className={styles.board} aria-label="Schedule">
          {status === 'ready' && <Board />}
          {status === 'error' && (
            <div className={styles.loadError} role="alert">
              <p>The schedule couldn't be loaded. {loadError}</p>
              <Button onClick={() => window.location.reload()}>Try again</Button>
            </div>
          )}
        </main>
        <footer className={styles.footer}>
          <Toast />
          {!readOnly && <HintBar />}
          {!readOnly && <Dock />}
        </footer>
      </div>
      <SheetHost />
    </MotionConfig>
  );
}

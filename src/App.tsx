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

export default function App() {
  useAppLifecycle();
  useKeyboardShortcuts();
  const ready = useScheduleStore((s) => s.status === 'ready');

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.app}>
        <Header />
        <FilterBar />
        <SelectionBar />
        <main className={styles.board} aria-label="Schedule">
          {ready && <Board />}
        </main>
        <footer className={styles.footer}>
          <Toast />
          <HintBar />
          <Dock />
        </footer>
      </div>
      <SheetHost />
    </MotionConfig>
  );
}

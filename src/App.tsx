import { MotionConfig } from 'motion/react';
import styles from './App.module.css';
import { Dock } from './components/Dock';
import { Header } from './components/Header';
import { SelectionBar } from './components/SelectionBar';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useScheduleStore } from './store/useScheduleStore';
import { Board } from './views/Board';

export default function App() {
  useAppLifecycle();
  const ready = useScheduleStore((s) => s.status === 'ready');

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.app}>
        <Header />
        <SelectionBar />
        <main className={styles.board} aria-label="Schedule">
          {ready && <Board />}
        </main>
        <footer className={styles.footer}>
          <Dock />
        </footer>
      </div>
    </MotionConfig>
  );
}

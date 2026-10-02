import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import styles from './App.module.css';
import { applyTheme, loadPreferences } from './data/preferences';

export default function App() {
  useEffect(() => {
    applyTheme(loadPreferences().theme);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.app}>
        <header style={{ padding: '12px 16px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Team schedule</h1>
        </header>
        <main className={styles.board} aria-label="Schedule" />
        <footer className={styles.footer} />
      </div>
    </MotionConfig>
  );
}

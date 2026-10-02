import { useEffect } from 'react';
import { applyTheme, savePreferences } from '../data/preferences';
import { repository, scheduleStore } from '../store/useScheduleStore';

/** Loads the schedule, keeps per-device preferences saved, and flushes writes on exit. */
export function useAppLifecycle(): void {
  useEffect(() => {
    const store = scheduleStore;
    void store.getState().init();
    applyTheme(store.getState().theme);

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.theme !== previous.theme) applyTheme(state.theme);
      if (state.view !== previous.view || state.theme !== previous.theme) {
        savePreferences({ view: state.view, theme: state.theme });
      }
    });

    const flush = () => repository.flush?.();
    window.addEventListener('pagehide', flush);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
    };
  }, []);
}

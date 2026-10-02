import type { ViewMode } from '../domain/types';

/** Per-device UI preferences. Kept apart from schedule data on purpose. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  view: ViewMode;
  theme: ThemePreference;
}

export const PREFERENCES_KEY = 'schedule.prefs.v1';

const DEFAULT_PREFERENCES: Preferences = { view: 'week', theme: 'system' };

const VIEWS: readonly ViewMode[] = ['day', 'week', 'twoWeeks', 'month'];
const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function loadPreferences(storage: Storage | undefined = safeLocalStorage()): Preferences {
  try {
    const raw = storage?.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      view: VIEWS.includes(parsed.view as ViewMode) ? (parsed.view as ViewMode) : DEFAULT_PREFERENCES.view,
      theme: THEMES.includes(parsed.theme as ThemePreference)
        ? (parsed.theme as ThemePreference)
        : DEFAULT_PREFERENCES.theme,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Preferences, storage: Storage | undefined = safeLocalStorage()): void {
  try {
    storage?.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be full or blocked. Preferences are a convenience, so ignore.
  }
}

/** Sets or clears `data-theme` on <html>. "system" leaves it to prefers-color-scheme. */
export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

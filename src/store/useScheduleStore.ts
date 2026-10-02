import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { LocalStorageRepository } from '../data/localStorageRepository';
import { loadPreferences, type ThemePreference } from '../data/preferences';
import type { ViewMode } from '../domain/types';
import { createDataSlice, type StoreDeps } from './slices/dataSlice';
import { createFiltersSlice } from './slices/filtersSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createToolSlice } from './slices/toolSlice';
import { createUiSlice } from './slices/uiSlice';
import { createUndoSlice } from './slices/undoSlice';
import { createViewSlice } from './slices/viewSlice';
import type { StoreState } from './types';

export interface StoreOptions extends StoreDeps {
  view?: ViewMode;
  theme?: ThemePreference;
}

/** Builds a store. Tests create their own with an in-memory repository. */
export function createScheduleStore({ repository, view = 'week', theme = 'system' }: StoreOptions) {
  return createStore<StoreState>()((...args) => ({
    ...createDataSlice({ repository })(...args),
    ...createUndoSlice(...args),
    ...createViewSlice(view)(...args),
    ...createToolSlice(...args),
    ...createSelectionSlice(...args),
    ...createFiltersSlice(...args),
    ...createUiSlice(theme)(...args),
  }));
}

export type ScheduleStore = ReturnType<typeof createScheduleStore>;

const preferences = loadPreferences();

export const repository = new LocalStorageRepository();

/** The app's single store. */
export const scheduleStore = createScheduleStore({
  repository,
  view: preferences.view,
  theme: preferences.theme,
});

export function useScheduleStore<T>(selector: (state: StoreState) => T): T {
  return useStore(scheduleStore, selector);
}

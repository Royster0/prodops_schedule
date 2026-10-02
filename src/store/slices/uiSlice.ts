import type { StateCreator } from 'zustand';
import type { ThemePreference } from '../../data/preferences';
import type { StoreState, UiSlice } from '../types';

let toastCounter = 0;

export function createUiSlice(initialTheme: ThemePreference): StateCreator<StoreState, [], [], UiSlice> {
  return (set, get) => ({
    sheets: [],
    toast: null,
    theme: initialTheme,

    openSheet: (sheet) => set({ sheets: [...get().sheets, sheet] }),
    replaceSheet: (sheet) => set({ sheets: [...get().sheets.slice(0, -1), sheet] }),
    closeSheet: () => set({ sheets: get().sheets.slice(0, -1) }),
    closeAllSheets: () => set({ sheets: [] }),

    showToast: (message, options) => set({ toast: { id: ++toastCounter, message, undo: options?.undo ?? false } }),
    dismissToast: () => set({ toast: null }),

    setTheme: (theme) => set({ theme }),
  });
}

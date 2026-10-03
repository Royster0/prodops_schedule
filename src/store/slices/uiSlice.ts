import type { StateCreator } from 'zustand';
import type { ThemePreference } from '../../data/preferences';
import type { SheetState, StoreState, UiSlice } from '../types';

let toastCounter = 0;

/** People who can only view open shifts and time off to read them, and Manage. Nothing that adds. */
export function viewerCanOpen(sheet: SheetState): boolean {
  if (sheet.kind === 'shift') return Boolean(sheet.shiftId);
  if (sheet.kind === 'timeOff') return Boolean(sheet.timeOffId);
  return sheet.kind === 'manage';
}

export function createUiSlice(initialTheme: ThemePreference): StateCreator<StoreState, [], [], UiSlice> {
  return (set, get) => ({
    sheets: [],
    toast: null,
    theme: initialTheme,

    openSheet: (sheet) => {
      if (get().readOnly && !viewerCanOpen(sheet)) return;
      set({ sheets: [...get().sheets, sheet] });
    },
    replaceSheet: (sheet) => {
      if (get().readOnly && !viewerCanOpen(sheet)) return;
      set({ sheets: [...get().sheets.slice(0, -1), sheet] });
    },
    closeSheet: () => set({ sheets: get().sheets.slice(0, -1) }),
    closeAllSheets: () => set({ sheets: [] }),

    showToast: (message, options) =>
      set({ toast: { id: ++toastCounter, message, undo: options?.undo ?? false } }),
    dismissToast: () => set({ toast: null }),

    setTheme: (theme) => set({ theme }),
  });
}

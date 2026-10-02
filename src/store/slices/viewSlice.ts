import type { StateCreator } from 'zustand';
import { today } from '../../domain/dates';
import { shiftAnchor } from '../../domain/period';
import type { StoreState, ViewSlice } from '../types';

export function createViewSlice(initialView: ViewSlice['view']): StateCreator<StoreState, [], [], ViewSlice> {
  return (set, get) => ({
    view: initialView,
    anchor: today(),
    setView: (view) => set({ view }),
    goPrev: () => set({ anchor: shiftAnchor(get().view, get().anchor, -1) }),
    goNext: () => set({ anchor: shiftAnchor(get().view, get().anchor, 1) }),
    goToday: () => set({ anchor: today() }),
    openDay: (date) => set({ view: 'day', anchor: date }),
  });
}

import type { StateCreator } from 'zustand';
import { applyOps } from '../../domain/changeSet';
import { invertOps } from '../../domain/undo';
import { pruneMissing } from '../prune';
import type { StoreState, UndoSlice } from '../types';

export const createUndoSlice: StateCreator<StoreState, [], [], UndoSlice> = (set, get) => ({
  undoStack: [],

  undo() {
    const stack = get().undoStack;
    const entry = stack[stack.length - 1];
    if (!entry) {
      get().showToast('Nothing to undo.');
      return;
    }
    const ops = invertOps(entry.ops);
    set({ data: applyOps(get().data, ops), undoStack: stack.slice(0, -1) });
    const stale = pruneMissing(get());
    if (stale) set(stale);
    get().persistOps(ops);
    get().showToast(`Undid: ${entry.label}.`);
  },
});

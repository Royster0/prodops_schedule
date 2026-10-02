import type { StateCreator } from 'zustand';
import { ChangeSet } from '../../domain/changeSet';
import { createStarterData } from '../../domain/seed';
import { pushUndo } from '../../domain/undo';
import type { ScheduleRepository } from '../../data/repository';
import { markCreated } from '../freshness';
import { pruneMissing } from '../prune';
import type { DataSlice, StoreState } from '../types';

export interface StoreDeps {
  repository: ScheduleRepository;
}

/** Schedule data, loading, saving, and the single commit path for every change. */
export function createDataSlice({ repository }: StoreDeps): StateCreator<StoreState, [], [], DataSlice> {
  let pendingWrites = 0;

  return (set, get) => ({
    data: createStarterData(),
    status: 'loading',
    saveState: 'saved',
    savedLabel: repository.savedLabel,

    async init() {
      const data = await repository.load();
      set({ data, status: 'ready' });
      // A server-backed repository pushes changes made elsewhere.
      repository.subscribe?.((next) => {
        set({ data: next });
        const stale = pruneMissing(get());
        if (stale) set(stale);
      });
    },

    commit(label, change, options) {
      const changes = new ChangeSet(get().data);
      const result = change(changes);
      const ops = changes.ops;
      if (ops.length > 0) {
        markCreated(ops);
        set({ data: changes.data, undoStack: pushUndo(get().undoStack, { label, ops }) });
        const stale = pruneMissing(get());
        if (stale) set(stale);
        get().persistOps(ops);
      }
      const toast = typeof options?.toast === 'function' ? options.toast(result) : options?.toast;
      if (toast) get().showToast(toast, { undo: ops.length > 0 });
      return result;
    },

    persistOps(ops) {
      if (ops.length === 0) return;
      pendingWrites++;
      set({ saveState: 'saving' });
      repository.apply(ops).then(
        () => {
          pendingWrites--;
          if (pendingWrites === 0) set({ saveState: 'saved' });
        },
        (error: unknown) => {
          pendingWrites--;
          console.error('Saving failed', error);
          set({ saveState: 'error' });
        },
      );
    },
  });
}

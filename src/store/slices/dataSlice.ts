import type { StateCreator } from 'zustand';
import { ChangeSet, applyOps } from '../../domain/changeSet';
import { createStarterData } from '../../domain/seed';
import { invertOps, pushUndo } from '../../domain/undo';
import type { ScheduleRepository } from '../../data/repository';
import { markCreated } from '../freshness';
import { pruneMissing } from '../prune';
import type { DataSlice, StoreState } from '../types';

export const VIEW_ONLY_MESSAGE = 'You can view this schedule but not change it.';
const DEFAULT_ERROR_LABEL = "Couldn't save. Storage may be full.";

export interface StoreDeps {
  repository: ScheduleRepository;
}

/** Schedule data, loading, saving, and the single commit path for every change. */
export function createDataSlice({ repository }: StoreDeps): StateCreator<StoreState, [], [], DataSlice> {
  let pendingWrites = 0;
  let loading: Promise<void> | null = null;

  return (set, get) => {
    async function load(): Promise<void> {
      let data;
      try {
        data = await repository.load();
      } catch (error) {
        console.error('Loading failed', error);
        const message =
          error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? '');
        set({ status: 'error', loadError: message || 'Something went wrong.' });
        return;
      }
      set({
        data,
        status: 'ready',
        loadError: null,
        savedLabel: repository.savedLabel,
        errorLabel: repository.errorLabel ?? DEFAULT_ERROR_LABEL,
        readOnly: repository.readOnly ?? false,
      });
      // A server-backed repository pushes changes made elsewhere.
      repository.subscribe?.((next) => {
        set({ data: next });
        const stale = pruneMissing(get());
        if (stale) set(stale);
      });
    }

    return {
      data: createStarterData(),
      status: 'loading',
      loadError: null,
      saveState: 'saved',
      savedLabel: repository.savedLabel,
      errorLabel: repository.errorLabel ?? DEFAULT_ERROR_LABEL,
      readOnly: false,

      init() {
        // Once per store, even if React mounts the app twice in development.
        loading ??= load();
        return loading;
      },

      commit(label, change, options) {
        const changes = new ChangeSet(get().data);
        const result = change(changes);
        if (get().readOnly) {
          if (changes.ops.length > 0) get().showToast(VIEW_ONLY_MESSAGE);
          return result;
        }
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
        if (get().readOnly) {
          // A paint stroke shows as it goes; put things back for viewers.
          set({ data: applyOps(get().data, invertOps(ops)), undoStack: [] });
          const stale = pruneMissing(get());
          if (stale) set(stale);
          get().showToast(VIEW_ONLY_MESSAGE);
          return;
        }
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
    };
  };
}

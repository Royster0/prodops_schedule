import { applyOps } from '../domain/changeSet';
import { createStarterData } from '../domain/seed';
import type { ChangeOp, ScheduleData } from '../domain/types';
import { safeLocalStorage } from './preferences';
import type { ScheduleRepository } from './repository';
import { SCHEMA_VERSION, migrate, type StoredSchedule } from './schema';

export const STORAGE_KEY = 'schedule.v1';

interface Options {
  storage?: Storage;
  /** Writes are debounced so a burst of changes becomes one write. */
  debounceMs?: number;
  seed?: () => ScheduleData;
}

/** Stores the whole schedule under one versioned localStorage key. */
export class LocalStorageRepository implements ScheduleRepository {
  readonly savedLabel = 'Saved in this browser';

  private readonly storage: Storage | undefined;
  private readonly debounceMs: number;
  private readonly seed: () => ScheduleData;
  private data: ScheduleData | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private waiting: { resolve: () => void; reject: (error: unknown) => void }[] = [];

  constructor({ storage = safeLocalStorage(), debounceMs = 250, seed = createStarterData }: Options = {}) {
    this.storage = storage;
    this.debounceMs = debounceMs;
    this.seed = seed;
  }

  async load(): Promise<ScheduleData> {
    const raw = this.storage?.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.data = migrate(JSON.parse(raw));
        return this.data;
      } catch (error) {
        // Keep the unreadable copy rather than overwrite it, then start fresh.
        console.warn('Saved schedule could not be read. A backup was kept.', error);
        this.storage?.setItem(`${STORAGE_KEY}.unreadable`, raw);
      }
    }
    this.data = this.seed();
    this.write();
    return this.data;
  }

  apply(ops: ChangeOp[]): Promise<void> {
    if (!this.data) return Promise.reject(new Error('Load the schedule before saving changes.'));
    this.data = applyOps(this.data, ops);
    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject });
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), this.debounceMs);
    });
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const waiting = this.waiting;
    this.waiting = [];
    try {
      this.write();
      waiting.forEach((w) => w.resolve());
    } catch (error) {
      waiting.forEach((w) => w.reject(error));
    }
  }

  private write(): void {
    if (!this.storage || !this.data) return;
    const stored: StoredSchedule = { version: SCHEMA_VERSION, data: this.data };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
}

/**
 * Hands over the schedule saved in this browser, once: the copy is moved aside so a
 * later sign-in with another account doesn't pick it up again. Null when there is none.
 */
export function takeLocalSchedule(storage: Storage | undefined = safeLocalStorage()): ScheduleData | null {
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = migrate(JSON.parse(raw));
    storage!.setItem(`${STORAGE_KEY}.moved`, raw);
    storage!.removeItem(STORAGE_KEY);
    return data;
  } catch (error) {
    console.warn('The schedule saved in this browser could not be read.', error);
    return null;
  }
}

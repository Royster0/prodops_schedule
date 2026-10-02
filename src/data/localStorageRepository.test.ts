import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeSet } from '../domain/changeSet';
import { createStarterData } from '../domain/seed';
import { employee } from '../testing/fixtures';
import { memoryStorage } from '../testing/memoryStorage';
import { LocalStorageRepository, STORAGE_KEY } from './localStorageRepository';

describe('LocalStorageRepository', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('seeds starter data on first run and stores it', async () => {
    const storage = memoryStorage();
    const data = await new LocalStorageRepository({ storage }).load();
    expect(Object.keys(data.templates)).toHaveLength(5);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(1);
  });

  it('debounces writes and resolves once stored', async () => {
    const storage = memoryStorage();
    const repo = new LocalStorageRepository({ storage, debounceMs: 250 });
    const data = await repo.load();
    const setItem = vi.spyOn(storage, 'setItem');

    const changes = new ChangeSet(data);
    changes.put('employees', employee('ana'));
    const first = repo.apply(changes.ops);
    const second = new ChangeSet(changes.data);
    second.put('employees', employee('ben'));
    const done = repo.apply(second.ops);

    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    await Promise.all([first, done]);
    expect(setItem).toHaveBeenCalledTimes(1);

    const reloaded = await new LocalStorageRepository({ storage }).load();
    expect(Object.keys(reloaded.employees).sort()).toEqual(['ana', 'ben']);
  });

  it('keeps an unreadable copy and starts fresh', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{"version":1,"data":{"shifts":"nope"}}' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = await new LocalStorageRepository({ storage }).load();
    expect(Object.keys(data.templates)).toHaveLength(5);
    expect(storage.getItem(`${STORAGE_KEY}.unreadable`)).toContain('nope');
  });

  it('loads what it saved, including settings', async () => {
    const seeded = createStarterData();
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, data: { ...seeded, settings: { ...seeded.settings, clock: 24 } } }),
    });
    const data = await new LocalStorageRepository({ storage }).load();
    expect(data.settings.clock).toBe(24);
    expect(data.templates).toEqual(seeded.templates);
  });
});

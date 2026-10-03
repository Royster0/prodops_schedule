import { describe, expect, it, vi } from 'vitest';
import { serializeSchedule } from './exportImport';
import { STORAGE_KEY } from './localStorageRepository';
import { CURRENT_SCHEDULE_KEY, SupabaseRepository } from './supabaseRepository';
import { toRow } from './supabaseRows';
import { employee, makeData, shift } from '../testing/fixtures';
import { fakeSupabase } from '../testing/fakeSupabase';
import { memoryStorage } from '../testing/memoryStorage';
import type { ChangeOp, ScheduleData } from '../domain/types';

const row = (
  collection: 'employees' | 'shifts',
  record: Parameters<typeof toRow>[1],
  updatedBy = 'other-tab',
) => ({
  ...toRow(collection, record as never),
  id: record.id,
  schedule_id: 'sched-1',
  updated_by: updatedBy,
});

const put = (record: ReturnType<typeof shift>): ChangeOp => ({
  collection: 'shifts',
  id: record.id,
  before: null,
  after: record,
});

async function loaded(options: Parameters<typeof fakeSupabase>[0] = {}) {
  const fake = fakeSupabase(options);
  const repo = new SupabaseRepository(fake.client, {
    clientId: 'my-tab',
    storage: memoryStorage(),
    emitDelayMs: 0,
  });
  const data = await repo.load();
  return { fake, repo, data };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('SupabaseRepository', () => {
  it('loads every table, paging past the API row limit', async () => {
    const shifts = Array.from({ length: 1500 }, (_, i) => row('shifts', shift(`s${i}`, 'ana', '2026-10-01')));
    const { data, repo } = await loaded({ rows: { employees: [row('employees', employee('ana'))], shifts } });
    expect(Object.keys(data.shifts)).toHaveLength(1500);
    expect(data.employees.ana.name).toBe('ana');
    expect(data.settings.title).toBe('Team schedule');
    expect(repo.readOnly).toBe(false);
  });

  it('moves the schedule kept in this browser into a new account, once', async () => {
    const local = makeData({ employees: [employee('ana')], shifts: [shift('s1', 'ana', '2026-10-01')] });
    local.settings.title = 'Ops team';
    const storage = memoryStorage({ [STORAGE_KEY]: serializeSchedule(local) });
    const fake = fakeSupabase({ created: true });
    const repo = new SupabaseRepository(fake.client, { clientId: 'my-tab', storage });

    const data = await repo.load();

    expect(Object.keys(data.shifts)).toEqual(['s1']);
    expect(data.settings.title).toBe('Ops team');
    expect(fake.applyCalls).toHaveLength(1);
    expect(fake.applyCalls[0].p_ops.map((op) => `${op.table}:${op.id}`)).toEqual(
      expect.arrayContaining(['employees:ana', 'shifts:s1', 'schedules:settings']),
    );
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(`${STORAGE_KEY}.moved`)).not.toBeNull();
  });

  it('starts a new account with the starter templates when this browser has nothing', async () => {
    const fake = fakeSupabase({ created: true });
    const repo = new SupabaseRepository(fake.client, { storage: memoryStorage() });
    const data = await repo.load();
    expect(Object.keys(data.templates).length).toBeGreaterThan(0);
    expect(fake.applyCalls).toHaveLength(1);
  });

  it('sends writes one at a time, in order, folding what queued up', async () => {
    const { fake, repo } = await loaded({ holdWrites: true });
    const first = repo.apply([put(shift('s1', 'ana', '2026-10-01'))]);
    const second = repo.apply([put(shift('s2', 'ana', '2026-10-01'))]);
    const third = repo.apply([put(shift('s3', 'ana', '2026-10-01'))]);

    expect(fake.applyCalls).toHaveLength(1);
    fake.applyCalls[0].settle();
    await first;
    await tick();
    expect(fake.applyCalls).toHaveLength(2);
    expect(fake.applyCalls[1].p_ops.map((op) => op.id)).toEqual(['s2', 's3']);
    expect(fake.applyCalls[1].p_client).toBe('my-tab');
    fake.applyCalls[1].settle();
    await Promise.all([second, third]);
  });

  it('rejects a failed write and shows what the server has', async () => {
    const { fake, repo } = await loaded({ holdWrites: true });
    const seen: ScheduleData[] = [];
    repo.subscribe((data) => seen.push(data));
    const write = repo.apply([put(shift('s1', 'ana', '2026-10-01'))]);
    fake.applyCalls[0].settle({ message: 'network down' });
    await expect(write).rejects.toMatchObject({ message: 'network down' });
    await tick();
    expect(seen.at(-1)?.shifts).toEqual({});
  });

  it('refuses writes from viewers without calling the server', async () => {
    const { fake, repo } = await loaded({ role: 'viewer' });
    expect(repo.readOnly).toBe(true);
    await expect(repo.apply([put(shift('s1', 'ana', '2026-10-01'))])).rejects.toThrow(/view/);
    expect(fake.applyCalls).toHaveLength(0);
  });

  it("applies teammates' changes and ignores its own echoes", async () => {
    const { fake, repo } = await loaded({ rows: { employees: [row('employees', employee('ana'))] } });
    const seen: ScheduleData[] = [];
    repo.subscribe((data) => seen.push(data));

    fake.emit('shifts', 'INSERT', row('shifts', shift('mine', 'ana', '2026-10-01'), 'my-tab'));
    await tick();
    expect(seen).toHaveLength(0);

    fake.emit('shifts', 'INSERT', row('shifts', shift('theirs', 'ana', '2026-10-01')));
    fake.emit('schedules', 'UPDATE', {
      id: 'sched-1',
      title: 'Ops',
      week_start: 0,
      clock: 24,
      day_start: 6,
      day_end: 22,
      updated_by: 'other-tab',
    });
    await tick();
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0].shifts)).toEqual(['theirs']);
    expect(seen[0].settings).toMatchObject({ title: 'Ops', clock: 24 });
  });

  it("ignores other schedules' deletes and the echo of its own", async () => {
    const { fake, repo } = await loaded({
      rows: {
        employees: [row('employees', employee('ana'))],
        shifts: [
          row('shifts', shift('s1', 'ana', '2026-10-01')),
          row('shifts', shift('s2', 'ana', '2026-10-01')),
        ],
      },
    });
    const seen: ScheduleData[] = [];
    repo.subscribe((data) => seen.push(data));

    await repo.apply([
      { collection: 'shifts', id: 's1', before: shift('s1', 'ana', '2026-10-01'), after: null },
    ]);
    fake.emit('shifts', 'DELETE', { schedule_id: 'sched-1', id: 's1' });
    fake.emit('shifts', 'DELETE', { schedule_id: 'another', id: 's2' });
    await tick();
    expect(seen).toHaveLength(0);

    fake.emit('shifts', 'DELETE', { schedule_id: 'sched-1', id: 's2' });
    await tick();
    expect(Object.keys(seen[0].shifts)).toEqual([]);
  });

  it('catches up after the realtime connection comes back', async () => {
    const { fake, repo } = await loaded();
    const seen: ScheduleData[] = [];
    repo.subscribe((data) => seen.push(data));
    fake.rows.shifts = [row('shifts', shift('missed', 'ana', '2026-10-01'))];
    fake.reconnect();
    await vi.waitFor(() => expect(Object.keys(seen.at(-1)?.shifts ?? {})).toEqual(['missed']));
  });

  it('knows who owns the schedule', async () => {
    const owned = await loaded({
      settings: { title: 'T', week_start: 1, clock: 12, day_start: 5, day_end: 23, owner_id: 'me' },
    });
    expect(owned.repo.ownerId).toBe('me');
    expect(owned.repo.isOwner).toBe(false); // no signed-in user given

    const fake = fakeSupabase({ created: true });
    const repo = new SupabaseRepository(fake.client, { userId: 'me', storage: memoryStorage() });
    await repo.load();
    expect(repo.isOwner).toBe(true);
  });

  it('opens the schedule picked last time and remembers the one it opened', async () => {
    const storage = memoryStorage({ [CURRENT_SCHEDULE_KEY]: 'sched-2' });
    const fake = fakeSupabase({ scheduleId: 'sched-1' });
    const repo = new SupabaseRepository(fake.client, { storage });
    await repo.load();
    expect(fake.joinCalls).toEqual([{ preferred: 'sched-2' }]);
    // The server said sched-2 isn't available, so sched-1 is now the one to open.
    expect(storage.getItem(CURRENT_SCHEDULE_KEY)).toBe('sched-1');
    repo.switchTo('sched-3');
    expect(storage.getItem(CURRENT_SCHEDULE_KEY)).toBe('sched-3');
  });

  it("leaves this browser's schedule alone when the account already has one, and says so", async () => {
    const local = serializeSchedule(makeData({ employees: [employee('ana')] }));
    const storage = memoryStorage({ [STORAGE_KEY]: local });
    const repo = new SupabaseRepository(fakeSupabase().client, { storage });
    await repo.load();
    expect(repo.hasLocalLeftover).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBe(local);

    const viewer = new SupabaseRepository(fakeSupabase({ role: 'viewer' }).client, { storage });
    await viewer.load();
    expect(viewer.hasLocalLeftover).toBe(false);
  });
});

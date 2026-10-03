import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { ChangeSet, applyOps, emptyCollections } from '../domain/changeSet';
import { createId } from '../domain/ids';
import { createStarterData, DEFAULT_SETTINGS } from '../domain/seed';
import { COLLECTION_NAMES, SETTINGS_ID, type ChangeOp, type ScheduleData } from '../domain/types';
import { replaceAll } from './exportImport';
import { hasLocalSchedule, takeLocalSchedule } from './localStorageRepository';
import { safeLocalStorage } from './preferences';
import type { ScheduleRepository } from './repository';
import {
  COLLECTION_BY_TABLE,
  SETTINGS_TABLE,
  TABLES,
  fromRow,
  settingsFromRow,
  toRowOp,
  type Row,
} from './supabaseRows';

export type ScheduleRole = 'editor' | 'viewer';

/** A schedule this person belongs to, for switching between them. */
export interface ScheduleMembership {
  scheduleId: string;
  title: string;
  role: ScheduleRole;
  ownerId: string | null;
}

/** Remembers which schedule to open for people on more than one. */
export const CURRENT_SCHEDULE_KEY = 'schedule.current';

interface Options {
  /** The signed-in user, who owns any schedule created for them. */
  userId?: string;
  /** Identifies this tab's writes so their realtime echo can be ignored. */
  clientId?: string;
  /** Where a schedule kept in this browser before sign-in is picked up from. */
  storage?: Storage;
  /** Realtime bursts are folded into one update. */
  emitDelayMs?: number;
}

interface Batch {
  ops: ChangeOp[];
  waiters: { resolve(): void; reject(error: unknown): void }[];
}

const PAGE_SIZE = 1000;
/** How long our own deletes are remembered, to ignore their realtime echo. */
const DELETE_ECHO_MS = 15_000;

/**
 * Stores the schedule in Supabase (see supabase/migrations). One user action is one
 * call to apply_changes, which writes it in a single transaction. Writes are sent
 * one at a time and in order, so a quick undo can never land before the change it
 * undoes. Teammates' changes arrive through realtime.
 */
export class SupabaseRepository implements ScheduleRepository {
  readonly savedLabel = 'Saved';
  readonly errorLabel = "Couldn't save. Check your connection.";

  scheduleId: string | null = null;
  role: ScheduleRole = 'viewer';
  /** Who owns the open schedule and decides who can see or change it. */
  ownerId: string | null = null;
  /** This browser still holds a schedule from before sign-in that wasn't moved. */
  hasLocalLeftover = false;

  readonly client: SupabaseClient;
  private readonly clientId: string;
  private readonly userId: string | undefined;
  private readonly storage: Storage | undefined;
  private readonly emitDelayMs: number;
  /** What the server has, as far as this tab knows. */
  private confirmed: ScheduleData | null = null;
  private inFlight: Batch | null = null;
  private queue: Batch[] = [];
  private recentDeletes = new Map<string, number>();
  private listener: ((data: ScheduleData) => void) | null = null;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    client: SupabaseClient,
    { userId, clientId = createId(), storage, emitDelayMs = 60 }: Options = {},
  ) {
    this.client = client;
    this.userId = userId;
    this.clientId = clientId;
    this.storage = storage;
    this.emitDelayMs = emitDelayMs;
  }

  get readOnly(): boolean {
    return this.role !== 'editor';
  }

  get isOwner(): boolean {
    return !!this.userId && this.ownerId === this.userId;
  }

  async load(): Promise<ScheduleData> {
    const preferred = readKey(this.storage, this.currentKey);
    const { data, error } = await this.client.rpc('join_schedule', preferred ? { preferred } : {});
    if (error) throw error;
    const joined = (Array.isArray(data) ? data[0] : data) as
      | { schedule_id: string; role: ScheduleRole; created: boolean }
      | undefined;
    if (!joined) throw new Error('No schedule was found for this account.');
    this.scheduleId = joined.schedule_id;
    this.role = joined.role;
    writeKey(this.storage, this.currentKey, joined.schedule_id);

    if (joined.created) {
      this.ownerId = this.userId ?? null;
      // A new schedule: bring over what this browser had before sign-in, or start fresh.
      const start = takeLocalSchedule(this.storage) ?? createStarterData();
      const empty: ScheduleData = { ...emptyCollections(), settings: { ...DEFAULT_SETTINGS } };
      const changes = new ChangeSet(empty);
      replaceAll(changes, start);
      this.confirmed = empty;
      await this.apply(changes.ops);
      return this.current();
    }

    this.confirmed = await this.fetchAll();
    this.hasLocalLeftover = !this.readOnly && hasLocalSchedule(this.storage);
    return this.confirmed;
  }

  clearLocalLeftover(): void {
    this.hasLocalLeftover = false;
  }

  /** Every schedule this person is on, for the switcher in Settings. */
  async listSchedules(): Promise<ScheduleMembership[]> {
    if (!this.userId) return [];
    const { data, error } = await this.client
      .from('schedule_members')
      .select('schedule_id, role, schedules(title, owner_id)')
      .eq('user_id', this.userId)
      .order('joined_at');
    if (error) throw error;
    return (data as unknown as { schedule_id: string; role: ScheduleRole; schedules: Row | null }[]).map(
      (m) => ({
        scheduleId: m.schedule_id,
        title: String(m.schedules?.title ?? 'Team schedule'),
        role: m.role,
        ownerId: (m.schedules?.owner_id as string | null) ?? null,
      }),
    );
  }

  /** Opens another schedule this person is on. The page reloads into it. */
  switchTo(scheduleId: string): void {
    writeKey(this.storage, this.currentKey, scheduleId);
  }

  /**
   * Emails someone a sign-in link to this app. Signing in with it claims their invite,
   * so it works as the invite email. New addresses get an account on the way in.
   */
  async sendInviteEmail(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: appUrl(), shouldCreateUser: true },
    });
    if (error) throw error;
  }

  /** Per account, so two people sharing a browser each keep their own choice. */
  private get currentKey(): string {
    return this.userId ? `${CURRENT_SCHEDULE_KEY}.${this.userId}` : CURRENT_SCHEDULE_KEY;
  }

  apply(ops: ChangeOp[]): Promise<void> {
    if (!this.confirmed || !this.scheduleId) {
      return Promise.reject(new Error('Load the schedule before saving changes.'));
    }
    if (this.readOnly) {
      return Promise.reject(new Error('You can view this schedule but not change it.'));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ ops, waiters: [{ resolve, reject }] });
      void this.pump();
    });
  }

  subscribe(onChange: (data: ScheduleData) => void): () => void {
    this.listener = onChange;
    const id = this.scheduleId;
    if (!id) return () => {};

    let channel: RealtimeChannel = this.client.channel(`schedule:${id}:${createId()}`);
    const handle = (payload: RealtimePostgresChangesPayload<Row>) => this.onRealtime(payload);
    for (const table of [...Object.values(TABLES), SETTINGS_TABLE]) {
      const filter = table === SETTINGS_TABLE ? `id=eq.${id}` : `schedule_id=eq.${id}`;
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, handle)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, handle);
      // Deletes can't be filtered; onRealtime drops other schedules' by their key.
      if (table !== SETTINGS_TABLE) {
        channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, handle);
      }
    }

    let connectedBefore = false;
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // After a dropped connection, catch up on anything missed.
      if (connectedBefore) void this.resync();
      connectedBefore = true;
    });

    return () => {
      this.listener = null;
      void this.client.removeChannel(channel);
    };
  }

  /** Reloads everything from the server and keeps this tab's unsent changes on top. */
  async resync(): Promise<void> {
    try {
      this.confirmed = await this.fetchAll();
      this.emitSoon();
    } catch (error) {
      console.warn('Could not refresh the schedule', error);
    }
  }

  /** Server state plus every change still on its way. */
  private current(): ScheduleData {
    let data = this.confirmed!;
    if (this.inFlight) data = applyOps(data, this.inFlight.ops);
    for (const batch of this.queue) data = applyOps(data, batch.ops);
    return data;
  }

  private async pump(): Promise<void> {
    if (this.inFlight || this.queue.length === 0) return;
    // Everything queued behind a slow write goes out together, still in order.
    const batch: Batch = {
      ops: this.queue.flatMap((b) => b.ops),
      waiters: this.queue.flatMap((b) => b.waiters),
    };
    this.queue = [];
    this.inFlight = batch;

    const now = Date.now();
    for (const op of batch.ops)
      if (op.after === null) this.recentDeletes.set(echoKey(op.collection, op.id), now);

    const { error } = await this.client.rpc('apply_changes', {
      p_schedule: this.scheduleId,
      p_client: this.clientId,
      p_ops: batch.ops.map(toRowOp),
    });
    this.inFlight = null;
    if (error) {
      // Nothing in the batch was stored. Show what the server has, then check it.
      batch.waiters.forEach((w) => w.reject(error));
      this.emitSoon();
      void this.resync();
    } else {
      this.confirmed = applyOps(this.confirmed!, batch.ops);
      batch.waiters.forEach((w) => w.resolve());
    }
    void this.pump();
  }

  private onRealtime(payload: RealtimePostgresChangesPayload<Row>): void {
    if (!this.confirmed) return;
    const table = payload.table;
    const id = this.scheduleId;

    if (table === SETTINGS_TABLE) {
      const row = payload.new as Row;
      if (row.id !== id || row.updated_by === this.clientId) return;
      const settings = settingsFromRow(row);
      this.confirmed = applyOps(this.confirmed, [
        { collection: 'settings', id: SETTINGS_ID, before: this.confirmed.settings, after: settings },
      ]);
      this.emitSoon();
      return;
    }

    const collection = COLLECTION_BY_TABLE[table];
    if (!collection) return;

    if (payload.eventType === 'DELETE') {
      const old = payload.old as Row;
      const recordId = String(old.id ?? '');
      if (old.schedule_id !== id || !this.confirmed[collection][recordId]) return;
      const key = echoKey(collection, recordId);
      const deletedAt = this.recentDeletes.get(key);
      if (deletedAt !== undefined && Date.now() - deletedAt < DELETE_ECHO_MS) return;
      this.recentDeletes.delete(key);
      this.confirmed = applyOps(this.confirmed, [
        { collection, id: recordId, before: this.confirmed[collection][recordId], after: null } as ChangeOp,
      ]);
      this.emitSoon();
      return;
    }

    const row = payload.new as Row;
    if (row.schedule_id !== id || row.updated_by === this.clientId) return;
    const record = fromRow(collection, row);
    this.confirmed = applyOps(this.confirmed, [
      {
        collection,
        id: record.id,
        before: this.confirmed[collection][record.id] ?? null,
        after: record,
      } as ChangeOp,
    ]);
    this.emitSoon();
  }

  private emitSoon(): void {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      if (this.confirmed) this.listener?.(this.current());
    }, this.emitDelayMs);
  }

  private async fetchAll(): Promise<ScheduleData> {
    const id = this.scheduleId!;
    const settingsQuery = this.client
      .from(SETTINGS_TABLE)
      .select('title, week_start, clock, day_start, day_end, owner_id')
      .eq('id', id)
      .single();
    const [settings, ...tables] = await Promise.all([
      settingsQuery,
      ...COLLECTION_NAMES.map((name) => this.fetchTable(TABLES[name])),
    ]);
    if (settings.error) throw settings.error;
    this.ownerId = ((settings.data as Row).owner_id as string | null) ?? null;

    const data = { ...emptyCollections(), settings: settingsFromRow(settings.data as Row) } as ScheduleData;
    COLLECTION_NAMES.forEach((name, i) => {
      const records = tables[i].map((row) => fromRow(name, row));
      (data[name] as Record<string, unknown>) = Object.fromEntries(records.map((r) => [r.id, r]));
    });
    return data;
  }

  /** Every row of one table for this schedule, a page at a time (the API caps each response). */
  private async fetchTable(table: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .eq('schedule_id', this.scheduleId!)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data as Row[]));
      if (data.length < PAGE_SIZE) return rows;
    }
  }
}

/** Where sign-in links bring people back: this app, without any hash or query. */
export function appUrl(): string {
  return typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;
}

function readKey(storage: Storage | undefined, key: string): string | null {
  try {
    return (storage ?? safeLocalStorage())?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeKey(storage: Storage | undefined, key: string, value: string): void {
  try {
    (storage ?? safeLocalStorage())?.setItem(key, value);
  } catch {
    // Only a convenience: without it the latest joined schedule opens.
  }
}

function echoKey(collection: string, id: string): string {
  return `${collection}:${id}`;
}

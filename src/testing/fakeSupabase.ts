import type { SupabaseClient } from '@supabase/supabase-js';
import type { Row, RowOp } from '../data/supabaseRows';

type Result = { data: unknown; error: { message: string } | null };
type Handler = (payload: Record<string, unknown>) => void;

export interface ApplyCall {
  p_schedule: string;
  p_client: string;
  p_ops: RowOp[];
  /** Finishes the call. Calls finish on their own unless `holdWrites` is set. */
  settle(error?: { message: string }): void;
}

/**
 * Just enough of the Supabase client for SupabaseRepository: rpc, paged selects and
 * a realtime channel whose events tests push by hand.
 */
export function fakeSupabase({
  scheduleId = 'sched-1',
  role = 'editor',
  created = false,
  rows = {},
  settings = { title: 'Team schedule', week_start: 1, clock: 12, day_start: 5, day_end: 23 },
  holdWrites = false,
}: {
  scheduleId?: string;
  role?: 'editor' | 'viewer';
  created?: boolean;
  rows?: Record<string, Row[]>;
  settings?: Row;
  holdWrites?: boolean;
} = {}) {
  const applyCalls: ApplyCall[] = [];
  const joinCalls: Record<string, unknown>[] = [];
  const otpCalls: Record<string, unknown>[] = [];
  /** Calls to other functions (assign_person, set_schedule_open), with what had been applied by then. */
  const rpcCalls: { name: string; args: Record<string, unknown>; appliedBefore: number }[] = [];
  const handlers: { event: string; table: string; handler: Handler }[] = [];
  let onStatus: ((status: string) => void) | null = null;

  const query = (table: string) => {
    let range: [number, number] = [0, Number.MAX_SAFE_INTEGER];
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      range: (from: number, to: number) => {
        range = [from, to];
        return builder;
      },
      single: () => Promise.resolve({ data: settings, error: null }),
      then: (resolve: (r: Result) => unknown) =>
        Promise.resolve({ data: (rows[table] ?? []).slice(range[0], range[1] + 1), error: null }).then(
          resolve,
        ),
    };
    return builder;
  };

  const channel = {
    on: (_type: string, filter: { event: string; table: string }, handler: Handler) => {
      handlers.push({ event: filter.event, table: filter.table, handler });
      return channel;
    },
    subscribe: (callback: (status: string) => void) => {
      onStatus = callback;
      callback('SUBSCRIBED');
      return channel;
    },
  };

  const client = {
    rpc: (name: string, args: Omit<ApplyCall, 'settle'>) => {
      if (name === 'join_schedule') {
        joinCalls.push(args as Record<string, unknown>);
        return Promise.resolve({ data: [{ schedule_id: scheduleId, role, created }], error: null });
      }
      if (name !== 'apply_changes') {
        const settled = applyCalls.length;
        rpcCalls.push({ name, args: args as unknown as Record<string, unknown>, appliedBefore: settled });
        return Promise.resolve({ data: name === 'assign_person' ? 'member' : null, error: null });
      }
      return new Promise<Result>((resolve) => {
        const call: ApplyCall = { ...args, settle: (error) => resolve({ data: null, error: error ?? null }) };
        applyCalls.push(call);
        if (!holdWrites) call.settle();
      });
    },
    from: query,
    auth: {
      signInWithOtp: (args: Record<string, unknown>) => {
        otpCalls.push(args);
        return Promise.resolve({ data: {}, error: null });
      },
    },
    channel: () => channel,
    removeChannel: () => Promise.resolve('ok'),
  };

  return {
    client: client as unknown as SupabaseClient,
    applyCalls,
    joinCalls,
    otpCalls,
    rpcCalls,
    rows,
    /** Pushes a realtime event as Supabase would. */
    emit(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: Row) {
      const payload =
        eventType === 'DELETE'
          ? { table, eventType, old: row, new: {} }
          : { table, eventType, new: row, old: {} };
      for (const h of handlers) if (h.table === table && h.event === eventType) h.handler(payload);
    },
    reconnect() {
      onStatus?.('SUBSCRIBED');
    },
  };
}

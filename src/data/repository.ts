import type { ChangeOp, ScheduleData } from '../domain/types';

/**
 * Where schedule data lives. The UI only talks to this interface, so storage can
 * move from the browser to a server (see SUPABASE.md) without touching the UI.
 */
export interface ScheduleRepository {
  load(): Promise<ScheduleData>;
  /** Batched writes from one user action. Resolves once they are stored. */
  apply(ops: ChangeOp[]): Promise<void>;
  /** Realtime changes from elsewhere. Not used by the local implementation. */
  subscribe?(onChange: (data: ScheduleData) => void): () => void;
  /** Writes anything still pending, e.g. when the page is hidden. */
  flush?(): void;
  /** Header status once all writes have landed, e.g. "Saved in this browser". */
  readonly savedLabel: string;
}

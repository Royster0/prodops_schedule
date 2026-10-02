import type { ChangeOp } from './types';

/** One user action, recorded so it can be undone. */
export interface UndoEntry {
  label: string;
  ops: ChangeOp[];
}

export const UNDO_LIMIT = 60;

/**
 * Merges ops on the same record into one, keeping the first `before` and the
 * last `after`. Drops records that ended where they started, including ones
 * created and deleted within the same action.
 */
export function collapseOps(ops: readonly ChangeOp[]): ChangeOp[] {
  const merged = new Map<string, ChangeOp>();
  for (const op of ops) {
    const key = `${op.collection}:${op.id}`;
    const existing = merged.get(key);
    merged.set(key, existing ? ({ ...existing, after: op.after } as ChangeOp) : op);
  }
  return [...merged.values()].filter((op) => !sameValue(op.before, op.after));
}

/** The ops that undo `ops`: reverse order, before and after swapped. */
export function invertOps(ops: readonly ChangeOp[]): ChangeOp[] {
  return [...ops].reverse().map((op) => ({ ...op, before: op.after, after: op.before }) as ChangeOp);
}

/** Adds an entry, keeping only the most recent `limit` entries. */
export function pushUndo(stack: readonly UndoEntry[], entry: UndoEntry, limit = UNDO_LIMIT): UndoEntry[] {
  if (entry.ops.length === 0) return [...stack];
  const next = [...stack, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

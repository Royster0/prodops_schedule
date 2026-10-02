import type { ChangeOp, ID } from '../domain/types';

/*
 * Remembers which shifts and time off were created by the person in this
 * session, so only those animate in. Kept outside React state on purpose:
 * it never needs to trigger a render.
 */

const FRESH_FOR_MS = 1200;
const createdAt = new Map<ID, number>();

export function markCreated(ops: readonly ChangeOp[], now = Date.now()): void {
  for (const op of ops) {
    if ((op.collection === 'shifts' || op.collection === 'timeOff') && op.before === null && op.after) {
      createdAt.set(op.id, now);
    }
  }
  if (createdAt.size > 5000) {
    for (const [id, at] of createdAt) if (now - at > FRESH_FOR_MS) createdAt.delete(id);
  }
}

/** True for records created moments ago. Old records and first loads never animate. */
export function isFresh(id: ID, now = Date.now()): boolean {
  const at = createdAt.get(id);
  return at !== undefined && now - at < FRESH_FOR_MS;
}

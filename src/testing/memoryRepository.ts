import type { ScheduleRepository } from '../data/repository';
import { applyOps } from '../domain/changeSet';
import type { ChangeOp, ScheduleData } from '../domain/types';

/** A repository that keeps data in memory and records each batch of ops. */
export function memoryRepository(initial: ScheduleData) {
  const batches: ChangeOp[][] = [];
  let stored = initial;
  const repository: ScheduleRepository = {
    savedLabel: 'Saved',
    load: async () => stored,
    apply: async (ops) => {
      batches.push(ops);
      stored = applyOps(stored, ops);
    },
  };
  return { repository, batches, stored: () => stored };
}

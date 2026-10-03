import { useMemo } from 'react';
import type { Matcher } from '../domain/filters';
import type { TemplateLookup } from '../domain/shifts';
import type { Clock } from '../domain/time';
import type { ID, Tag } from '../domain/types';
import { selectMatcher } from '../store/derived';
import { useScheduleStore } from '../store/useScheduleStore';

/** Everything a block needs to draw itself. One object, so cells compare props cheaply. */
export interface BlockContext {
  templates: TemplateLookup;
  tags: Readonly<Record<ID, Tag>>;
  clock: Clock;
  dayStart: number;
  dayEnd: number;
  matcher: Matcher;
  /** The person can only view: no add buttons on empty spots. */
  readOnly: boolean;
}

export function useBlockContext(): BlockContext {
  const templates = useScheduleStore((s) => s.data.templates);
  const tags = useScheduleStore((s) => s.data.tags);
  const clock = useScheduleStore((s) => s.data.settings.clock);
  const dayStart = useScheduleStore((s) => s.data.settings.dayStart);
  const dayEnd = useScheduleStore((s) => s.data.settings.dayEnd);
  const matcher = useScheduleStore(selectMatcher);
  const readOnly = useScheduleStore((s) => s.readOnly);
  return useMemo(
    () => ({ templates, tags, clock, dayStart, dayEnd, matcher, readOnly }),
    [templates, tags, clock, dayStart, dayEnd, matcher, readOnly],
  );
}

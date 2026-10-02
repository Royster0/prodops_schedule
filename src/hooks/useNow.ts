import { useEffect, useState } from 'react';
import { today as todayOf } from '../domain/dates';
import type { ISODate } from '../domain/types';

/** The current time, refreshed every minute. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    // Align ticks to the start of each minute so the "now" line moves on time.
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

/** Today's date. Rolls over at midnight. */
export function useToday(): ISODate {
  return todayOf(useNow());
}

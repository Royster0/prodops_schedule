import { useSyncExternalStore } from 'react';

/** True while the media query matches. Re-renders when it changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Breakpoints from the responsive spec. */
export const NARROW = '(max-width: 760px)';
export const PHONE_SHEET = '(max-width: 600px)';
export const TINY = '(max-width: 520px)';
export const COARSE_POINTER = '(pointer: coarse)';

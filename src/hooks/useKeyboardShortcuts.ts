import { useEffect } from 'react';
import { selectTemplates } from '../store/derived';
import { scheduleStore } from '../store/useScheduleStore';
import type { ViewMode } from '../domain/types';

const VIEW_KEYS: Record<string, ViewMode> = { d: 'day', w: 'week', m: 'month' };

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Board shortcuts: arrows move the period, T today, D/W/M views, V/E/1–9 tools,
 * Escape back to Select, Ctrl or Cmd+Z undo. Ignored while typing or in a dialog.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = scheduleStore.getState();
      if (event.defaultPrevented || state.sheets.length > 0 || isTyping(event.target)) return;
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        state.undo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as HTMLElement | null)?.closest('[role="menu"], [role="radiogroup"]')) return;

      if (key === 'arrowleft') state.goPrev();
      else if (key === 'arrowright') state.goNext();
      else if (key === 't') state.goToday();
      else if (VIEW_KEYS[key]) state.setView(VIEW_KEYS[key]);
      else if (key === 'v' || key === 'escape') state.setTool({ kind: 'select' });
      else if (key === 'e') state.toggleTool({ kind: 'erase' });
      else if (/^[1-9]$/.test(key)) {
        const template = selectTemplates(state)[Number(key) - 1];
        if (!template) return;
        state.toggleTool({ kind: 'template', templateId: template.id });
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

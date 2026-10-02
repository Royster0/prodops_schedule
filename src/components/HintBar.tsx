import type { CSSProperties } from 'react';
import { TIME_OFF_COLORS, TIME_OFF_LABELS } from '../domain/color';
import { formatTimeRange } from '../domain/time';
import type { ShiftTemplate, Tool } from '../domain/types';
import { COARSE_POINTER, useMediaQuery } from '../hooks/useMediaQuery';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './Bars.module.css';
import { Button } from './Button';
import { Reveal } from './Reveal';

/** One sentence explaining the active brush, plus Done. */
export function HintBar() {
  const tool = useScheduleStore((s) => s.tool);
  const templates = useScheduleStore((s) => s.data.templates);
  const clock = useScheduleStore((s) => s.data.settings.clock);
  const selected = useScheduleStore((s) => s.selectedIds.size);
  const isMonth = useScheduleStore((s) => s.view === 'month');
  const touch = useMediaQuery(COARSE_POINTER);
  const hint = describeTool(tool, templates, clock, selected);

  return (
    <Reveal open={hint !== null}>
      {hint && (
        <div className={styles.bar} role="status">
          <span className={styles.dot} style={hint.dot} aria-hidden="true" />
          <p className={styles.text}>
            <strong>{hint.title}</strong> {hint.body}
            {touch && (isMonth ? ' Drag the dates to scroll.' : ' Drag the names to scroll.')}
          </p>
          <Button size="sm" onClick={() => scheduleStore.getState().setTool({ kind: 'select' })}>
            Done
          </Button>
        </div>
      )}
    </Reveal>
  );
}

interface Hint {
  title: string;
  body: string;
  dot: CSSProperties;
}

function describeTool(
  tool: Tool,
  templates: Readonly<Record<string, ShiftTemplate>>,
  clock: 12 | 24,
  selected: number,
): Hint | null {
  const everyone = selected > 1 ? `the ${selected} selected` : 'everyone shown';
  switch (tool.kind) {
    case 'select':
      return null;
    case 'template': {
      const template = templates[tool.templateId];
      if (!template) return null;
      return {
        title: `Painting ${template.name} (${formatTimeRange(template.start, template.end, clock)}).`,
        body: `Tap or drag across days. Tap a date to fill ${everyone}.`,
        dot: { background: template.color },
      };
    }
    case 'erase':
      return {
        title: 'Erasing.',
        body: `Tap or drag across days to remove shifts, then time off. Tap a date to clear ${everyone}.`,
        dot: { background: 'var(--surface)', boxShadow: 'inset 0 0 0 2px var(--ink-2)' },
      };
    case 'timeOff': {
      const color = TIME_OFF_COLORS[tool.type];
      return {
        title: `Painting ${TIME_OFF_LABELS[tool.type]}.`,
        body: `Tap or drag across days to mark time off. Tap a date to mark ${everyone}.`,
        dot: {
          background: `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 5px)`,
          boxShadow: `inset 0 0 0 1.5px ${color}`,
        },
      };
    }
  }
}

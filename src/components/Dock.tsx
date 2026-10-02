import { motion } from 'motion/react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { TIME_OFF_COLORS, TIME_OFF_LABELS, TIME_OFF_TYPES, textOn } from '../domain/color';
import { sameTool } from '../domain/painting';
import { formatTimeRange } from '../domain/time';
import type { Tool } from '../domain/types';
import { selectTemplates } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './Dock.module.css';
import { Icon } from './Icon';

/** The paint palette: tools, one swatch per template, time off brushes and Undo. */
export function Dock() {
  const tool = useScheduleStore((s) => s.tool);
  const templates = useScheduleStore(selectTemplates);
  const clock = useScheduleStore((s) => s.data.settings.clock);
  const canUndo = useScheduleStore((s) => s.undoStack.length > 0);
  const { toggleTool, setTool, undo, openSheet } = scheduleStore.getState();

  return (
    <div className={styles.dock} role="toolbar" aria-label="Paint palette">
      <ToolButton tool={{ kind: 'select' }} active={tool} onPick={setTool} shortcut="V">
        <Icon name="select" size={18} />
        <span className={styles.toolLabel}>Select</span>
      </ToolButton>
      <ToolButton tool={{ kind: 'erase' }} active={tool} onPick={toggleTool} shortcut="E">
        <Icon name="erase" size={18} />
        <span className={styles.toolLabel}>Erase</span>
      </ToolButton>

      <span className={styles.divider} aria-hidden="true" />

      {templates.map((template, index) => (
        <ToolButton
          key={template.id}
          tool={{ kind: 'template', templateId: template.id }}
          active={tool}
          onPick={toggleTool}
          shortcut={index < 9 ? String(index + 1) : undefined}
        >
          <span
            className={styles.swatch}
            style={{ background: template.color, color: textOn(template.color) }}
          >
            {template.code}
          </span>
          <span className={styles.swatchText}>
            <span className={styles.swatchName}>{template.name}</span>
            <span className={styles.swatchTime}>{formatTimeRange(template.start, template.end, clock)}</span>
          </span>
        </ToolButton>
      ))}
      <button type="button" className={styles.addTemplate} onClick={() => openSheet({ kind: 'template' })}>
        <Icon name="plus" size={16} />
        Template
      </button>

      <span className={styles.divider} aria-hidden="true" />

      {TIME_OFF_TYPES.map((type) => (
        <ToolButton key={type} tool={{ kind: 'timeOff', type }} active={tool} onPick={toggleTool}>
          <span className={styles.hatch} style={{ '--off': TIME_OFF_COLORS[type] } as CSSProperties} />
          <span className={styles.toolLabel}>{TIME_OFF_LABELS[type]}</span>
        </ToolButton>
      ))}

      <span className={styles.divider} aria-hidden="true" />

      <button type="button" className={styles.tool} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Icon name="undo" size={18} />
        <span className={styles.toolLabel}>Undo</span>
      </button>
    </div>
  );
}

interface ToolButtonProps {
  tool: Tool;
  active: Tool;
  onPick(tool: Tool): void;
  shortcut?: string;
  children: ReactNode;
}

function ToolButton({ tool, active, onPick, shortcut, children }: ToolButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const isActive = sameTool(tool, active);

  // Keep the active tool visible when it changes from the keyboard.
  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [isActive]);

  return (
    <button
      ref={ref}
      type="button"
      className={styles.tool}
      aria-pressed={isActive}
      onClick={() => onPick(tool)}
      title={shortcut ? `Shortcut: ${shortcut}` : undefined}
    >
      {isActive && (
        <motion.span
          layoutId="dock-active-ring"
          className={styles.ring}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
        />
      )}
      {children}
    </button>
  );
}

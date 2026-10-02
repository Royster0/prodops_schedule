import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { TIME_OFF_COLORS, TIME_OFF_LABELS, TIME_OFF_TYPES, textOn } from '../domain/color';
import { sameTool } from '../domain/painting';
import { formatTimeRange } from '../domain/time';
import type { TimeOffType, Tool } from '../domain/types';
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

      <TimeOffGroup tool={tool} onPick={toggleTool} />

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

function Hatch({ type }: { type: TimeOffType }) {
  return <span className={styles.hatch} style={{ '--off': TIME_OFF_COLORS[type] } as CSSProperties} />;
}

/**
 * The time off brushes, collapsed behind one button. Collapsed, it shows the
 * active time off brush (if any) so the palette still says what is painting.
 */
function TimeOffGroup({ tool, onPick }: { tool: Tool; onPick(tool: Tool): void }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const active = tool.kind === 'timeOff' ? tool.type : null;
  const hidden = reduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 };

  return (
    <>
      <button
        type="button"
        className={styles.tool}
        aria-expanded={open}
        aria-controls="dock-time-off"
        aria-pressed={!open && active ? true : undefined}
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Hide time off brushes' : 'Show time off brushes'}
      >
        {!open && active && (
          <motion.span
            layoutId="dock-active-ring"
            className={styles.ring}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
          />
        )}
        {!open && active ? <Hatch type={active} /> : <Icon name="timeOff" size={18} />}
        <span className={styles.toolLabel}>{!open && active ? TIME_OFF_LABELS[active] : 'Time off'}</span>
        <Icon name={open ? 'chevronLeft' : 'chevronRight'} size={16} className={styles.chevron} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="dock-time-off"
            role="group"
            aria-label="Time off brushes"
            className={styles.group}
            initial={hidden}
            animate={{ width: 'auto', opacity: 1 }}
            exit={hidden}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {TIME_OFF_TYPES.map((type) => (
              <ToolButton key={type} tool={{ kind: 'timeOff', type }} active={tool} onPick={onPick}>
                <Hatch type={type} />
                <span className={styles.toolLabel}>{TIME_OFF_LABELS[type]}</span>
              </ToolButton>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

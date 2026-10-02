import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

interface PopoverProps {
  open: boolean;
  onClose(): void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Which edge of the anchor the panel lines up with. */
  align?: 'start' | 'end';
  /** Accessible name when the content is not a menu. */
  label?: string;
  role?: 'menu' | 'dialog' | 'listbox';
  className?: string;
}

const GAP = 6;
const EDGE = 8;

/**
 * A floating panel anchored to a button. Closes on outside click and Escape,
 * and hands focus back to the anchor.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = 'start',
  label,
  role,
  className,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Positions the panel by writing styles directly: it follows the anchor on
  // scroll and resize without re-rendering.
  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.scrollHeight;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - a.bottom - GAP - EDGE;
    const spaceAbove = a.top - GAP - EDGE;
    const above = height > spaceBelow && spaceAbove > spaceBelow;
    let left = align === 'start' ? a.left : a.right - width;
    left = Math.min(Math.max(EDGE, left), viewportW - width - EDGE);
    const maxHeight = Math.max(120, above ? spaceAbove : spaceBelow);
    const top = above ? Math.max(EDGE, a.top - GAP - Math.min(height, maxHeight)) : a.bottom + GAP;
    Object.assign(panel.style, { top: `${top}px`, left: `${left}px`, maxHeight: `${maxHeight}px` });
  }, [align, anchorRef]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    };
    const onViewportChange = () => place();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, onClose, anchorRef, place]);

  // Move focus into the panel so keyboard users land on the first item.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"], [role="menuitemcheckbox"], button, input, select, textarea, [tabindex="0"]',
    );
    first?.focus({ preventScroll: true });
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role={role}
          aria-label={label}
          className={[styles.panel, className].filter(Boolean).join(' ')}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

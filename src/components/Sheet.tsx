import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PHONE_SHEET, useMediaQuery } from '../hooks/useMediaQuery';
import { Button } from './Button';
import styles from './Sheet.module.css';

const TITLE_ID = 'sheet-title';
const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

interface SheetFrameProps {
  open: boolean;
  onClose(): void;
  /** Changes when a different sheet is shown in the same frame, to move focus into it. */
  contentKey: string;
  children: ReactNode;
}

/**
 * The dialog shell: a backdrop plus a centered panel, or a bottom sheet on phones.
 * Traps focus, closes on Escape and backdrop click, and returns focus on close.
 */
export function SheetFrame({ open, onClose, contentKey, children }: SheetFrameProps) {
  const phone = useMediaQuery(PHONE_SHEET);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    return () => {
      const target = returnFocusTo.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [open]);

  // Focus the first field of each sheet shown. On phones focus the panel
  // instead, so the keyboard doesn't pop up over the sheet.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = phone ? null : panel?.querySelector<HTMLElement>(`.${styles.body} :is(${FOCUSABLE})`);
    (first ?? panel)?.focus({ preventScroll: true });
  }, [open, contentKey, phone]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.layer} key="sheet">
          <motion.div
            className={styles.backdrop}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={TITLE_ID}
            tabIndex={-1}
            className={[styles.panel, phone && styles.bottom].filter(Boolean).join(' ')}
            onKeyDown={onKeyDown}
            initial={phone ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
            animate={phone ? { y: 0 } : { opacity: 1, scale: 1 }}
            exit={phone ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
            transition={
              phone
                ? { type: 'spring', bounce: 0, duration: 0.32 }
                : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface SheetProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** Shown before the title, e.g. a back button in stacked sheets. */
  back?: { label: string; onBack(): void };
}

/** Title, close button, scrollable body and footer actions. */
export function Sheet({ title, onClose, children, footer, back }: SheetProps) {
  return (
    <>
      <div className={styles.header}>
        {back && (
          <Button icon="chevronLeft" iconOnly variant="ghost" size="sm" onClick={back.onBack}>
            {back.label}
          </Button>
        )}
        <h2 id={TITLE_ID} className={styles.title}>
          {title}
        </h2>
        <Button icon="close" iconOnly variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  );
}

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface RevealProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

/** Opens and closes a bar by animating its height. Reduced motion gets a plain fade. */
export function Reveal({ open, children, className }: RevealProps) {
  const reduce = useReducedMotion();
  const closed = reduce ? { opacity: 0 } : { height: 0, opacity: 0 };
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className={className}
          style={{ overflow: 'hidden', flex: 'none' }}
          initial={closed}
          animate={{ height: 'auto', opacity: 1 }}
          exit={closed}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from 'react';
import { SheetFrame } from '../components/Sheet';
import type { SheetState } from '../store/types';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { ShiftSheet } from './ShiftSheet';
import { TimeOffSheet } from './TimeOffSheet';

/** Renders the sheet on top of the stack. Closing it reveals the one beneath. */
export function SheetHost() {
  const sheets = useScheduleStore((s) => s.sheets);
  const top = sheets[sheets.length - 1];
  const close = scheduleStore.getState().closeSheet;

  // Keep showing the last sheet while the frame animates out.
  const [shown, setShown] = useState<{ sheet: SheetState; depth: number } | null>(null);
  if (top && (shown?.sheet !== top || shown.depth !== sheets.length)) {
    setShown({ sheet: top, depth: sheets.length });
  }

  return (
    <SheetFrame open={Boolean(top)} onClose={close} contentKey={`${shown?.depth}:${shown?.sheet.kind}`}>
      {shown && <SheetContent key={shown.depth} sheet={shown.sheet} onClose={close} />}
    </SheetFrame>
  );
}

function SheetContent({ sheet, onClose }: { sheet: SheetState; onClose(): void }) {
  switch (sheet.kind) {
    case 'shift':
      return <ShiftSheet {...sheet} onClose={onClose} />;
    case 'timeOff':
      return <TimeOffSheet {...sheet} onClose={onClose} />;
    default:
      return null;
  }
}

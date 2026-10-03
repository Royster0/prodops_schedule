import { useState } from 'react';
import { SheetFrame } from '../components/Sheet';
import type { SheetState } from '../store/types';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { ApplySheet } from './ApplySheet';
import { ShiftDetails, TimeOffDetails } from './DetailsSheets';
import { ImportSheet } from './ImportSheet';
import { ManageSheet } from './manage/ManageSheet';
import { PatternSheet } from './PatternSheet';
import { PersonSheet } from './PersonSheet';
import { ShiftSheet } from './ShiftSheet';
import { TagSheet } from './TagSheet';
import { TemplateSheet } from './TemplateSheet';
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
  const readOnly = useScheduleStore((s) => s.readOnly);
  if (readOnly && sheet.kind === 'shift') return <ShiftDetails shiftId={sheet.shiftId} onClose={onClose} />;
  if (readOnly && sheet.kind === 'timeOff') {
    return <TimeOffDetails timeOffId={sheet.timeOffId} onClose={onClose} />;
  }
  switch (sheet.kind) {
    case 'shift':
      return <ShiftSheet {...sheet} onClose={onClose} />;
    case 'timeOff':
      return <TimeOffSheet {...sheet} onClose={onClose} />;
    case 'apply':
      return <ApplySheet preset={sheet.preset} onClose={onClose} />;
    case 'manage':
      return <ManageSheet tab={sheet.tab} onClose={onClose} />;
    case 'person':
      return <PersonSheet employeeId={sheet.employeeId} onClose={onClose} />;
    case 'template':
      return <TemplateSheet templateId={sheet.templateId} onClose={onClose} />;
    case 'pattern':
      return <PatternSheet patternId={sheet.patternId} onClose={onClose} />;
    case 'tag':
      return <TagSheet tagId={sheet.tagId} onClose={onClose} />;
    case 'import':
      return <ImportSheet data={sheet.data} fileName={sheet.fileName} onClose={onClose} />;
  }
}

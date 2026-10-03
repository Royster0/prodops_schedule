import { Button } from '../components/Button';
import { Notice, Spacer } from '../components/forms';
import { Sheet } from '../components/Sheet';
import { describeCounts, replaceAll } from '../data/exportImport';
import type { ScheduleData } from '../domain/types';
import { scheduleStore } from '../store/useScheduleStore';
import styles from './sheets.module.css';

/** Confirms an import: shows what the file holds, then replaces or cancels. */
export function ImportSheet({
  data,
  fileName,
  onClose,
}: {
  data: ScheduleData;
  fileName: string;
  onClose(): void;
}) {
  const replace = () => {
    const state = scheduleStore.getState();
    state.commit('import schedule', (changes) => replaceAll(changes, data), {
      toast: 'Imported the schedule.',
    });
    state.clearSelection();
    state.setTool({ kind: 'select' });
    state.closeAllSheets();
  };

  return (
    <Sheet
      title="Import schedule"
      onClose={onClose}
      footer={
        <>
          <Spacer />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="dangerSolid" onClick={replace}>
            Replace everything
          </Button>
        </>
      }
    >
      <p className={styles.lead}>
        <strong>{fileName}</strong> has {describeCounts(data)}.
      </p>
      <Notice tone="warning">
        Replacing removes everything in the schedule you have open and puts this one in its place. You can
        undo it right after.
      </Notice>
    </Sheet>
  );
}

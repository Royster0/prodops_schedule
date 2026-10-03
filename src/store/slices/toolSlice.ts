import type { StateCreator } from 'zustand';
import { ChangeSet, cellKey } from '../../domain/changeSet';
import {
  brushLabel,
  dateTargets,
  paintCell,
  paintTargets,
  sameTool,
  skippedTimeOffMessage,
} from '../../domain/painting';
import type { Brush, ChangeOp, ID, ISODate } from '../../domain/types';
import { collapseOps, pushUndo } from '../../domain/undo';
import { markCreated } from '../freshness';
import { selectVisibleIds } from '../derived';
import type { StoreState, ToolSlice } from '../types';

/** A paint stroke in progress. Lives outside React state: it never renders. */
interface Stroke {
  brush: Brush;
  /** People the stroke can reach, fixed when it starts. */
  visibleIds: readonly ID[];
  painted: Set<string>;
  ops: ChangeOp[];
  skipped: number;
  /** A Month day was painted with nobody selected, so there was no one to paint for. */
  needsSelection: boolean;
}

export const createToolSlice: StateCreator<StoreState, [], [], ToolSlice> = (set, get) => {
  let stroke: Stroke | null = null;

  /** Paints cells against current data and shows the result immediately. */
  const paint = (active: Stroke, cells: { employeeId: ID; date: ISODate }[]) => {
    const changes = new ChangeSet(get().data);
    for (const { employeeId, date } of cells) {
      const key = cellKey(employeeId, date);
      if (active.painted.has(key)) continue;
      active.painted.add(key);
      if (paintCell(changes, active.brush, employeeId, date) === 'skipped') active.skipped++;
    }
    const ops = changes.ops;
    if (ops.length === 0) return;
    markCreated(ops);
    active.ops.push(...ops);
    set({ data: changes.data });
  };

  const finish = (active: Stroke) => {
    const ops = collapseOps(active.ops);
    if (ops.length > 0) {
      const label = brushLabel(active.brush, get().data.templates);
      set({ undoStack: pushUndo(get().undoStack, { label, ops }) });
      get().persistOps(ops);
    }
    if (active.skipped > 0) get().showToast(skippedTimeOffMessage(active.skipped), { undo: ops.length > 0 });
    else if (active.needsSelection && ops.length === 0) {
      get().showToast('Select people above first, then paint their days. Tap a date to fill everyone shown.');
    }
  };

  const newStroke = (brush: Brush): Stroke => ({
    brush,
    visibleIds: selectVisibleIds(get()),
    painted: new Set(),
    ops: [],
    skipped: 0,
    needsSelection: false,
  });

  return {
    tool: { kind: 'select' },

    // People who can only view never pick up a brush.
    setTool: (tool) => set({ tool: get().readOnly ? { kind: 'select' } : tool }),

    toggleTool(tool) {
      if (get().readOnly) return;
      set({ tool: sameTool(get().tool, tool) ? { kind: 'select' } : tool });
    },

    beginStroke(brush) {
      if (stroke) finish(stroke);
      stroke = newStroke(brush);
    },

    strokeCell(employeeId, date) {
      if (!stroke) return;
      const targets = paintTargets(employeeId, get().selectedIds, stroke.visibleIds);
      paint(
        stroke,
        targets.map((id) => ({ employeeId: id, date })),
      );
    },

    strokeDay(date) {
      if (!stroke) return;
      const selected = stroke.visibleIds.filter((id) => get().selectedIds.has(id));
      if (selected.length === 0) {
        stroke.needsSelection = true;
        return;
      }
      paint(
        stroke,
        selected.map((employeeId) => ({ employeeId, date })),
      );
    },

    endStroke() {
      if (!stroke) return;
      const active = stroke;
      stroke = null;
      finish(active);
    },

    paintDate(date) {
      const tool = get().tool;
      if (tool.kind === 'select') return;
      const active = newStroke(tool);
      const targets = dateTargets(get().selectedIds, active.visibleIds);
      paint(
        active,
        targets.map((employeeId) => ({ employeeId, date })),
      );
      finish(active);
    },
  };
};

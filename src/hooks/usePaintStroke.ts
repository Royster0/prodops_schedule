import { useEffect, type RefObject } from 'react';
import { cellKey } from '../domain/changeSet';
import { scheduleStore } from '../store/useScheduleStore';
import { cellOf } from '../views/cellActions';

/** Fast drags can skip cells between pointer events; sample the path at this spacing. */
const SAMPLE_PX = 24;

/**
 * Pointer painting on the board. While a brush is active, pressing on a cell
 * starts a stroke; dragging paints every cell under the pointer. Stroke state
 * stays in this closure (not React state) and each new cell commits through
 * the store, so only touched cells re-render.
 */
export function usePaintStroke(boardRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let pointerId: number | null = null;
    let lastKey = '';
    let last = { x: 0, y: 0 };

    const paintAt = (x: number, y: number) => {
      const cell = cellOf(document.elementFromPoint(x, y));
      if (!cell) return;
      const key = cellKey(cell.employeeId, cell.date);
      if (key === lastKey) return;
      lastKey = key;
      scheduleStore.getState().strokeCell(cell.employeeId, cell.date);
    };

    const onPointerDown = (event: PointerEvent) => {
      const { tool, beginStroke } = scheduleStore.getState();
      if (tool.kind === 'select' || pointerId !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // Only cells paint. Names and date headers keep scrolling and clicking.
      if (!cellOf(event.target as Element)) return;
      event.preventDefault();
      pointerId = event.pointerId;
      board.setPointerCapture(event.pointerId);
      beginStroke(tool);
      lastKey = '';
      last = { x: event.clientX, y: event.clientY };
      paintAt(event.clientX, event.clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / SAMPLE_PX));
      for (let i = 1; i <= steps; i++) paintAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
      last = { x: event.clientX, y: event.clientY };
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
      scheduleStore.getState().endStroke();
    };

    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointermove', onPointerMove);
    board.addEventListener('pointerup', onPointerEnd);
    board.addEventListener('pointercancel', onPointerEnd);
    board.addEventListener('lostpointercapture', onPointerEnd);
    return () => {
      board.removeEventListener('pointerdown', onPointerDown);
      board.removeEventListener('pointermove', onPointerMove);
      board.removeEventListener('pointerup', onPointerEnd);
      board.removeEventListener('pointercancel', onPointerEnd);
      board.removeEventListener('lostpointercapture', onPointerEnd);
      if (pointerId !== null) scheduleStore.getState().endStroke();
    };
  }, [boardRef]);
}

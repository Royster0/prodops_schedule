import { describe, expect, it } from 'vitest';
import { employee, makeData, template, timeOff } from '../testing/fixtures';
import { memoryRepository } from '../testing/memoryRepository';
import { createScheduleStore } from './useScheduleStore';

async function setup() {
  const data = makeData({
    employees: [employee('ana', { order: 0 }), employee('ben', { order: 1 }), employee('cy', { order: 2 })],
    templates: [template('L10', { name: 'Long day', start: '07:00', end: '17:30' })],
    timeOff: [timeOff('t', 'cy', '2026-10-06', '2026-10-07')],
  });
  const memory = memoryRepository(data);
  const store = createScheduleStore({ repository: memory.repository });
  await store.getState().init();
  store.setState({ anchor: '2026-10-05', view: 'week' });
  return { store, memory };
}

const shiftCount = (state: { data: { shifts: object } }) => Object.keys(state.data.shifts).length;

describe('paint strokes', () => {
  it('a drag across 3 days for 2 selected people creates 6 shifts, and one undo removes all 6', async () => {
    const { store } = await setup();
    const s = store.getState();
    s.setSelected(['ana', 'ben']);
    s.beginStroke({ kind: 'template', templateId: 'L10' });
    for (const date of ['2026-10-05', '2026-10-06', '2026-10-07']) store.getState().strokeCell('ana', date);
    store.getState().endStroke();

    expect(shiftCount(store.getState())).toBe(6);
    expect(store.getState().undoStack).toHaveLength(1);
    expect(store.getState().undoStack[0].label).toBe('paint Long day');

    store.getState().undo();
    expect(shiftCount(store.getState())).toBe(0);
  });

  it('paints each cell once per stroke even when the pointer returns to it', async () => {
    const { store } = await setup();
    store.getState().beginStroke({ kind: 'erase' });
    store.getState().endStroke();
    store.getState().beginStroke({ kind: 'timeOff', type: 'sick' });
    store.getState().strokeCell('ana', '2026-10-05');
    store.getState().strokeCell('ana', '2026-10-06');
    store.getState().strokeCell('ana', '2026-10-05');
    store.getState().endStroke();
    expect(Object.values(store.getState().data.timeOff).filter((t) => t.employeeId === 'ana')).toMatchObject([
      { start: '2026-10-05', end: '2026-10-06', type: 'sick' },
    ]);
  });

  it('skips days with time off and says so', async () => {
    const { store } = await setup();
    store.getState().beginStroke({ kind: 'template', templateId: 'L10' });
    for (const date of ['2026-10-05', '2026-10-06', '2026-10-07']) store.getState().strokeCell('cy', date);
    store.getState().endStroke();

    expect(shiftCount(store.getState())).toBe(1);
    expect(store.getState().toast?.message).toBe(
      'Skipped 2 days with time off. Erase the time off first to schedule them.',
    );
  });

  it('fills a date for everyone shown when nobody is selected', async () => {
    const { store } = await setup();
    store.getState().setTool({ kind: 'template', templateId: 'L10' });
    store.getState().paintDate('2026-10-05');
    expect(shiftCount(store.getState())).toBe(3);
    expect(store.getState().undoStack).toHaveLength(1);
  });

  it('persists a stroke as one batch when it ends', async () => {
    const { store, memory } = await setup();
    store.getState().beginStroke({ kind: 'template', templateId: 'L10' });
    store.getState().strokeCell('ana', '2026-10-05');
    store.getState().strokeCell('ana', '2026-10-06');
    expect(memory.batches).toHaveLength(0);
    store.getState().endStroke();
    await Promise.resolve();
    expect(memory.batches).toHaveLength(1);
    expect(memory.batches[0]).toHaveLength(2);
  });

  it('toggles a brush back to Select when picked again', async () => {
    const { store } = await setup();
    store.getState().toggleTool({ kind: 'erase' });
    expect(store.getState().tool).toEqual({ kind: 'erase' });
    store.getState().toggleTool({ kind: 'erase' });
    expect(store.getState().tool).toEqual({ kind: 'select' });
  });
});

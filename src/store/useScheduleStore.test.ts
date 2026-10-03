import { describe, expect, it } from 'vitest';
import { employee, makeData, shift } from '../testing/fixtures';
import { memoryRepository } from '../testing/memoryRepository';
import { createScheduleStore } from './useScheduleStore';

describe('schedule store', () => {
  it('commits a change as one undo entry and persists it', async () => {
    const memory = memoryRepository(makeData({ employees: [employee('ana')] }));
    const store = createScheduleStore({ repository: memory.repository });
    await store.getState().init();

    store.getState().commit('add shifts', (changes) => {
      changes.put('shifts', shift('s1', 'ana', '2026-10-01'));
      changes.put('shifts', shift('s2', 'ana', '2026-10-02'));
    });

    expect(Object.keys(store.getState().data.shifts)).toHaveLength(2);
    expect(store.getState().undoStack).toHaveLength(1);
    await Promise.resolve();
    expect(memory.batches).toHaveLength(1);
    expect(Object.keys(memory.stored().shifts)).toHaveLength(2);
  });

  it('undoes the last change, persists the undo and says what it undid', async () => {
    const memory = memoryRepository(makeData({ employees: [employee('ana')] }));
    const store = createScheduleStore({ repository: memory.repository });
    await store.getState().init();

    store
      .getState()
      .commit('apply shifts', (changes) => changes.put('shifts', shift('s1', 'ana', '2026-10-01')));
    store.getState().undo();

    expect(store.getState().data.shifts).toEqual({});
    expect(store.getState().undoStack).toHaveLength(0);
    expect(store.getState().toast?.message).toBe('Undid: apply shifts.');
    await Promise.resolve();
    expect(memory.stored().shifts).toEqual({});
  });

  it('shows a toast with Undo when asked', async () => {
    const store = createScheduleStore({ repository: memoryRepository(makeData()).repository });
    await store.getState().init();
    store.getState().commit('add person', (changes) => changes.put('employees', employee('ana')), {
      toast: 'Added Ana.',
    });
    expect(store.getState().toast).toMatchObject({ message: 'Added Ana.', undo: true });
  });

  it('does not record an undo entry when nothing changed', async () => {
    const store = createScheduleStore({ repository: memoryRepository(makeData()).repository });
    await store.getState().init();
    store.getState().commit('nothing', () => {});
    expect(store.getState().undoStack).toHaveLength(0);
  });
});

describe('stale references', () => {
  it('drops deleted people, tags and templates from selection, filters and the brush', async () => {
    const { pattern, tag, template } = await import('../testing/fixtures');
    const store = createScheduleStore({
      repository: memoryRepository(
        makeData({
          employees: [employee('ana'), employee('ben')],
          tags: [tag('lead')],
          templates: [template('L10')],
          patterns: [pattern('p1', ['L10', '', '', '', '', '', ''])],
        }),
      ).repository,
    });
    await store.getState().init();
    store.getState().setSelected(['ana', 'ben']);
    store
      .getState()
      .setFilters({ people: ['ana'], tags: ['lead'], kinds: ['L10', 'off'], patterns: ['p1', 'gone'] });
    store.getState().setTool({ kind: 'template', templateId: 'L10' });

    store.getState().commit('delete', (changes) => {
      changes.remove('employees', 'ana');
      changes.remove('tags', 'lead');
      changes.remove('templates', 'L10');
    });

    const s = store.getState();
    expect([...s.selectedIds]).toEqual(['ben']);
    expect(s.filters).toMatchObject({ people: [], tags: [], kinds: ['off'], patterns: ['p1'] });
    expect(s.tool).toEqual({ kind: 'select' });
  });
});

describe('view only', () => {
  it('lets viewers open shifts and time off to read, but nothing that adds or edits', async () => {
    const memory = memoryRepository(makeData({ employees: [employee('ana')] }));
    const store = createScheduleStore({ repository: { ...memory.repository, readOnly: true } });
    await store.getState().init();
    const { openSheet, setTool, toggleTool } = store.getState();

    openSheet({ kind: 'shift', employeeId: 'ana' });
    openSheet({ kind: 'timeOff' });
    openSheet({ kind: 'apply' });
    openSheet({ kind: 'person', employeeId: 'ana' });
    openSheet({ kind: 'template' });
    expect(store.getState().sheets).toEqual([]);

    openSheet({ kind: 'shift', shiftId: 's1' });
    openSheet({ kind: 'timeOff', timeOffId: 'o1' });
    openSheet({ kind: 'manage', tab: 'holidays' });
    expect(store.getState().sheets.map((sheet) => sheet.kind)).toEqual(['shift', 'timeOff', 'manage']);

    toggleTool({ kind: 'erase' });
    setTool({ kind: 'erase' });
    expect(store.getState().tool).toEqual({ kind: 'select' });
  });

  it('keeps viewers from changing anything and says why', async () => {
    const memory = memoryRepository(makeData({ employees: [employee('ana')] }));
    const store = createScheduleStore({ repository: { ...memory.repository, readOnly: true } });
    await store.getState().init();

    store
      .getState()
      .commit('add shift', (changes) => changes.put('shifts', shift('s1', 'ana', '2026-10-01')));
    store
      .getState()
      .persistOps([
        { collection: 'shifts', id: 's2', before: null, after: shift('s2', 'ana', '2026-10-02') },
      ]);

    expect(store.getState().readOnly).toBe(true);
    expect(store.getState().undoStack).toHaveLength(0);
    expect(memory.batches).toHaveLength(0);
    expect(store.getState().toast?.message).toMatch(/view this schedule/);
  });

  it('shows why loading failed', async () => {
    const store = createScheduleStore({
      repository: {
        savedLabel: 'Saved',
        load: () => Promise.reject(new Error('Offline')),
        apply: async () => {},
      },
    });
    await store.getState().init();
    expect(store.getState()).toMatchObject({ status: 'error', loadError: 'Offline' });
  });
});

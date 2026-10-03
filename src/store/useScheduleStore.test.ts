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

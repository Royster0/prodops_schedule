import type { StoreState } from './types';

/**
 * UI state that points at deleted records: selected people, filter values and
 * the active template brush. Returns the fixes, or null when nothing is stale.
 * Runs after every change, so deleting, importing or undoing never leaves the
 * board filtering or painting with something that no longer exists.
 */
export function pruneMissing(state: StoreState): Partial<StoreState> | null {
  const { employees, tags, templates, patterns } = state.data;
  const patch: Partial<StoreState> = {};

  const selected = [...state.selectedIds].filter((id) => employees[id]);
  if (selected.length !== state.selectedIds.size) patch.selectedIds = new Set(selected);

  const { filters } = state;
  const people = filters.people.filter((id) => employees[id]);
  const tagIds = filters.tags.filter((id) => tags[id]);
  const kinds = filters.kinds.filter((kind) => kind === 'custom' || kind === 'off' || templates[kind]);
  const patternIds = filters.patterns.filter((id) => patterns[id]);
  if (
    people.length !== filters.people.length ||
    tagIds.length !== filters.tags.length ||
    kinds.length !== filters.kinds.length ||
    patternIds.length !== filters.patterns.length
  ) {
    patch.filters = { ...filters, people, tags: tagIds, kinds, patterns: patternIds };
  }

  if (state.tool.kind === 'template' && !templates[state.tool.templateId]) patch.tool = { kind: 'select' };

  return Object.keys(patch).length > 0 ? patch : null;
}

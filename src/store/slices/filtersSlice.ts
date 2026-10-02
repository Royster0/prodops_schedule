import type { StateCreator } from 'zustand';
import { EMPTY_FILTERS } from '../../domain/filters';
import type { FiltersSlice, StoreState } from '../types';

export const createFiltersSlice: StateCreator<StoreState, [], [], FiltersSlice> = (set, get) => ({
  filters: EMPTY_FILTERS,
  filterBarOpen: false,
  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  clearFilters: () => set({ filters: { ...EMPTY_FILTERS, hideEmpty: get().filters.hideEmpty } }),
  setFilterBarOpen: (open) => set({ filterBarOpen: open }),
});

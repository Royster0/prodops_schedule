import type { ChangeSet } from '../domain/changeSet';
import type { UndoEntry } from '../domain/undo';
import type {
  Brush,
  ChangeOp,
  Filters,
  HHMM,
  ID,
  ISODate,
  ScheduleData,
  TimeOffType,
  Tool,
  ViewMode,
} from '../domain/types';
import type { ThemePreference } from '../data/preferences';

/** The store is one Zustand store composed from these slices. */

export type SaveState = 'saved' | 'saving' | 'error';

export interface CommitOptions<R> {
  /** Toast shown after the change, with Undo. Return null for no toast. */
  toast?: string | ((result: R) => string | null);
}

export interface DataSlice {
  data: ScheduleData;
  status: 'loading' | 'ready';
  saveState: SaveState;
  savedLabel: string;
  init(): Promise<void>;
  /**
   * Runs a change against a working copy and commits everything it did as one
   * undo entry. `label` reads like "apply shifts" and appears in "Undid: …".
   */
  commit<R>(label: string, change: (changes: ChangeSet) => R, options?: CommitOptions<R>): R;
  /** Sends already-applied ops to the repository and tracks the save status. */
  persistOps(ops: ChangeOp[]): void;
}

export interface UndoSlice {
  undoStack: UndoEntry[];
  undo(): void;
}

export interface ViewSlice {
  view: ViewMode;
  anchor: ISODate;
  setView(view: ViewMode): void;
  goPrev(): void;
  goNext(): void;
  goToday(): void;
  /** Opens one date in Day view. */
  openDay(date: ISODate): void;
}

export interface ToolSlice {
  tool: Tool;
  setTool(tool: Tool): void;
  /** Picks a brush, or returns to Select when it is already active. */
  toggleTool(tool: Tool): void;
  beginStroke(brush: Brush): void;
  /** Paints one (person, date) during a stroke, fanning out to selected people. */
  strokeCell(employeeId: ID, date: ISODate): void;
  endStroke(): void;
  /** Paints a whole date for the selection or everyone shown. */
  paintDate(date: ISODate): void;
}

export interface SelectionSlice {
  selectedIds: ReadonlySet<ID>;
  toggleSelected(id: ID): void;
  setSelected(ids: Iterable<ID>): void;
  clearSelection(): void;
}

export interface FiltersSlice {
  filters: Filters;
  filterBarOpen: boolean;
  setFilters(patch: Partial<Filters>): void;
  clearFilters(): void;
  setFilterBarOpen(open: boolean): void;
}

export type ManageTab = 'people' | 'templates' | 'patterns' | 'tags' | 'holidays' | 'settings';

export interface ApplyPreset {
  mode?: 'template' | 'custom' | 'pattern' | 'timeOff';
  templateId?: ID;
  patternId?: ID;
  who?: 'one' | 'selected' | 'shown' | 'tag';
  employeeId?: ID;
}

/** Dialogs. They stack, so an editor opened from Manage returns to Manage. */
export type SheetState =
  | { kind: 'shift'; shiftId?: ID; employeeId?: ID; date?: ISODate; start?: HHMM }
  | { kind: 'timeOff'; timeOffId?: ID; employeeId?: ID; date?: ISODate; type?: TimeOffType }
  | { kind: 'apply'; preset?: ApplyPreset }
  | { kind: 'manage'; tab: ManageTab }
  | { kind: 'person'; employeeId?: ID }
  | { kind: 'template'; templateId?: ID }
  | { kind: 'pattern'; patternId?: ID }
  | { kind: 'tag'; tagId?: ID }
  | { kind: 'import'; data: ScheduleData; fileName: string };

export interface Toast {
  id: number;
  message: string;
  undo: boolean;
}

export interface UiSlice {
  sheets: SheetState[];
  toast: Toast | null;
  theme: ThemePreference;
  openSheet(sheet: SheetState): void;
  /** Replaces the top sheet instead of stacking on it. */
  replaceSheet(sheet: SheetState): void;
  closeSheet(): void;
  closeAllSheets(): void;
  showToast(message: string, options?: { undo?: boolean }): void;
  dismissToast(): void;
  setTheme(theme: ThemePreference): void;
}

export type StoreState = DataSlice & UndoSlice & ViewSlice & ToolSlice & SelectionSlice & FiltersSlice & UiSlice;

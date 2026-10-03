import { Sheet } from '../../components/Sheet';
import { Tabs } from '../../components/Tabs';
import type { ManageTab } from '../../store/types';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import { HolidaysTab } from './HolidaysTab';
import { PatternsTab } from './PatternsTab';
import { PeopleTab } from './PeopleTab';
import { SettingsTab } from './SettingsTab';
import { TagsTab } from './TagsTab';
import { TemplatesTab } from './TemplatesTab';

const TABS: readonly { value: ManageTab; label: string }[] = [
  { value: 'people', label: 'People' },
  { value: 'templates', label: 'Shift templates' },
  { value: 'patterns', label: 'Patterns' },
  { value: 'tags', label: 'Tags' },
  { value: 'holidays', label: 'Holidays' },
  { value: 'settings', label: 'Settings' },
];

/** People, templates, patterns, tags, holidays and settings in one place. */
/** Patterns only make shifts, so people who can only view don't see them. */
const VIEWER_TABS = TABS.filter((t) => t.value !== 'patterns');

export function ManageSheet({ tab: requested, onClose }: { tab: ManageTab; onClose(): void }) {
  const readOnly = useScheduleStore((s) => s.readOnly);
  const tabs = readOnly ? VIEWER_TABS : TABS;
  const tab = tabs.some((t) => t.value === requested) ? requested : 'people';
  // The tab lives in the sheet stack, so returning from an editor keeps it.
  const setTab = (next: ManageTab) => scheduleStore.getState().replaceSheet({ kind: 'manage', tab: next });
  return (
    <Sheet title="Manage" onClose={onClose}>
      <Tabs label="Manage" tabs={tabs} value={tab} onChange={setTab} idPrefix="manage" />
      <div id="manage-panel" role="tabpanel" aria-labelledby={`manage-tab-${tab}`}>
        {tab === 'people' && <PeopleTab />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'patterns' && <PatternsTab />}
        {tab === 'tags' && <TagsTab />}
        {tab === 'holidays' && <HolidaysTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </Sheet>
  );
}

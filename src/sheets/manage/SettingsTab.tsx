import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/Button';
import { Field, Group, Notice } from '../../components/forms';
import { Segmented } from '../../components/Segmented';
import { downloadSchedule, parseScheduleFile } from '../../data/exportImport';
import type { ThemePreference } from '../../data/preferences';
import { today } from '../../domain/dates';
import { removeDemoTeam } from '../../domain/demo';
import { count } from '../../domain/format';
import { formatHour } from '../../domain/time';
import type { Settings } from '../../domain/types';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import styles from './manage.module.css';

const START_HOURS = Array.from({ length: 13 }, (_, i) => i);
const END_HOURS = Array.from({ length: 12 }, (_, i) => i + 13);

export function SettingsTab() {
  const settings = useScheduleStore((s) => s.data.settings);
  const theme = useScheduleStore((s) => s.theme);
  const demoCount = useScheduleStore((s) => Object.values(s.data.employees).filter((e) => e.demo).length);
  const [title, setTitle] = useState(settings.title);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { commit, setTheme, openSheet } = scheduleStore.getState();

  const change = (patch: Partial<Settings>) => {
    const next = { ...scheduleStore.getState().data.settings, ...patch };
    commit('change settings', (changes) => changes.setSettings(next));
  };

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) setTitle(settings.title);
    else if (trimmed !== settings.title) change({ title: trimmed });
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = parseScheduleFile(await file.text());
      setImportError(null);
      openSheet({ kind: 'import', data, fileName: file.name });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "This file couldn't be read.");
    }
  };

  return (
    <>
      <Field label="Schedule title">
        {(id) => (
          <input
            id={id}
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
          />
        )}
      </Field>

      <Group label="Week starts on">
        <Segmented
          label="Week starts on"
          value={String(settings.weekStart)}
          onChange={(v) => change({ weekStart: v === '0' ? 0 : 1 })}
          options={[
            { value: '0', label: 'Sunday' },
            { value: '1', label: 'Monday' },
          ]}
        />
      </Group>

      <Group label="Time format">
        <Segmented
          label="Time format"
          value={String(settings.clock)}
          onChange={(v) => change({ clock: v === '24' ? 24 : 12 })}
          options={[
            { value: '12', label: '12-hour (1:30 PM)' },
            { value: '24', label: '24-hour (13:30)' },
          ]}
        />
      </Group>

      <div className={styles.addRow}>
        <Field label="Timeline starts at">
          {(id) => (
            <select
              id={id}
              value={settings.dayStart}
              onChange={(e) => change({ dayStart: Number(e.target.value) })}
            >
              {START_HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h, settings.clock)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Timeline ends at">
          {(id) => (
            <select
              id={id}
              value={settings.dayEnd}
              onChange={(e) => change({ dayEnd: Number(e.target.value) })}
            >
              {END_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? 'Midnight' : formatHour(h, settings.clock)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p className={styles.sectionHint}>
        Used for the Day view and the time track on each shift. Day view widens to fit.
      </p>

      <Group label="Appearance on this device">
        <Segmented<ThemePreference>
          label="Appearance"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Group>

      <div className={styles.divider} />

      <h3 className={styles.section}>Your data</h3>
      <p className={styles.sectionHint}>
        The schedule is saved in this browser. Export a copy to keep a backup or move it to another device.
      </p>
      <div className={styles.toolbar}>
        <Button icon="download" onClick={() => downloadSchedule(scheduleStore.getState().data, today())}>
          Export
        </Button>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>
          Import…
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>
      {importError && <Notice tone="warning">{importError}</Notice>}

      {demoCount > 0 && (
        <>
          <div className={styles.divider} />
          <h3 className={styles.section}>Demo team</h3>
          <p className={styles.sectionHint}>
            {count(demoCount, 'demo person', 'demo people')} and their shifts and time off.
          </p>
          <Button
            variant="danger"
            icon="trash"
            onClick={() =>
              commit('remove demo team', (changes) => removeDemoTeam(changes), {
                toast: 'Removed the demo team.',
              })
            }
          >
            Remove demo team
          </Button>
        </>
      )}
    </>
  );
}

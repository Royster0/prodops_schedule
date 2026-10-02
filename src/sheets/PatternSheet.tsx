import { useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDeleteButton, Field, Group, Spacer, Summary } from '../components/forms';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import { WEEKDAY_SHORT } from '../domain/dates';
import { createId } from '../domain/ids';
import { describePatternTotal, resizePatternDays } from '../domain/patterns';
import { nextOrder } from '../domain/shifts';
import type { ID, Pattern } from '../domain/types';
import { selectPatterns, selectTemplates } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './sheets.module.css';

/** Add or edit a repeating work pattern. */
export function PatternSheet({ patternId, onClose }: { patternId?: ID; onClose(): void }) {
  const existing = useScheduleStore((s) => (patternId ? s.data.patterns[patternId] : undefined));
  const templates = useScheduleStore(selectTemplates);
  const templatesById = useScheduleStore((s) => s.data.templates);
  const weekStart = useScheduleStore((s) => s.data.settings.weekStart);
  const [draft, setDraft] = useState<Pattern>(
    () =>
      existing ?? {
        id: createId(),
        name: '',
        length: 7,
        days: ['', '', '', '', '', '', ''],
        order: nextOrder(selectPatterns(scheduleStore.getState())),
      },
  );
  const name = draft.name.trim();
  const order = weekStart === 1 ? [0, 1, 2, 3, 4, 5, 6] : [6, 0, 1, 2, 3, 4, 5];
  const weeks = draft.length === 14 ? [0, 7] : [0];

  const setDay = (index: number, value: ID | '') =>
    setDraft((d) => ({ ...d, days: d.days.map((day, i) => (i === index ? value : day)) }));

  const save = () => {
    if (!name) return;
    scheduleStore
      .getState()
      .commit(existing ? 'edit pattern' : 'add pattern', (changes) =>
        changes.put('patterns', { ...draft, name }),
      );
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    scheduleStore.getState().commit('delete pattern', (changes) => changes.remove('patterns', existing.id), {
      toast: 'Pattern deleted.',
    });
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit pattern' : 'New pattern'}
      onClose={onClose}
      footer={
        <>
          {existing && <ConfirmDeleteButton onConfirm={remove} />}
          <Spacer />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!name}>
            {existing ? 'Save pattern' : 'Add pattern'}
          </Button>
        </>
      }
    >
      <Field label="Name" error={name ? null : 'Enter a name, e.g. 4×10, Mon to Thu.'}>
        {(id) => (
          <input
            id={id}
            value={draft.name}
            maxLength={60}
            placeholder="e.g. 4×10, Mon to Thu"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        )}
      </Field>
      <Group label="Repeats every">
        <Segmented
          label="Repeats every"
          value={String(draft.length)}
          onChange={(v) => {
            const length = v === '14' ? 14 : 7;
            setDraft((d) => ({ ...d, length, days: resizePatternDays(d.days, length) }));
          }}
          options={[
            { value: '7', label: '1 week' },
            { value: '14', label: '2 weeks' },
          ]}
        />
      </Group>

      {weeks.map((offset) => (
        <Group key={offset} label={weeks.length > 1 ? (offset === 0 ? 'Week A' : 'Week B') : 'Days'}>
          <div className={styles.patternGrid}>
            {order.map((i) => {
              const index = offset + i;
              const template = templatesById[draft.days[index]];
              const label = `${WEEKDAY_SHORT[(i + 1) % 7]}${weeks.length > 1 ? (offset === 0 ? ' week A' : ' week B') : ''}`;
              return (
                <div key={index} className={styles.patternDay}>
                  <span
                    className={styles.patternBar}
                    style={{ background: template?.color ?? 'var(--line)' }}
                    aria-hidden="true"
                  />
                  <label className={styles.patternLabel} htmlFor={`pattern-day-${index}`}>
                    {WEEKDAY_SHORT[(i + 1) % 7]}
                  </label>
                  <select
                    id={`pattern-day-${index}`}
                    aria-label={label}
                    value={template ? draft.days[index] : ''}
                    onChange={(e) => setDay(index, e.target.value)}
                  >
                    <option value="">Off</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </Group>
      ))}
      <Summary>
        <strong>{describePatternTotal(draft, templatesById)}</strong>
      </Summary>
    </Sheet>
  );
}

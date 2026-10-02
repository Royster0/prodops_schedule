import { useState } from 'react';
import { Button } from '../components/Button';
import { ColorSwatches, ConfirmDeleteButton, Field, Group, Spacer } from '../components/forms';
import { Sheet } from '../components/Sheet';
import { nextPaletteColor } from '../domain/color';
import { createId } from '../domain/ids';
import { deleteTag } from '../domain/manage';
import type { ID, Tag } from '../domain/types';
import { selectTags } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './sheets.module.css';

/** Add or edit a tag. Deleting removes it from people, templates and shifts. */
export function TagSheet({ tagId, onClose }: { tagId?: ID; onClose(): void }) {
  const existing = useScheduleStore((s) => (tagId ? s.data.tags[tagId] : undefined));
  const [draft, setDraft] = useState<Tag>(
    () =>
      existing ?? {
        id: createId(),
        name: '',
        color: nextPaletteColor(selectTags(scheduleStore.getState()).map((t) => t.color)),
      },
  );
  const name = draft.name.trim();

  const save = () => {
    if (!name) return;
    scheduleStore
      .getState()
      .commit(existing ? 'edit tag' : 'add tag', (changes) => changes.put('tags', { ...draft, name }));
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    scheduleStore.getState().commit('delete tag', (changes) => deleteTag(changes, existing.id), {
      toast: `Deleted the ${existing.name} tag.`,
    });
    const { filters, setFilters } = scheduleStore.getState();
    if (filters.tags.includes(existing.id))
      setFilters({ tags: filters.tags.filter((id) => id !== existing.id) });
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit tag' : 'New tag'}
      onClose={onClose}
      footer={
        <>
          {existing && <ConfirmDeleteButton onConfirm={remove} />}
          <Spacer />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!name}>
            {existing ? 'Save tag' : 'Add tag'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Name" error={name ? null : 'Enter a name.'}>
          {(id) => (
            <input
              id={id}
              value={draft.name}
              maxLength={30}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          )}
        </Field>
        <Group label="Color">
          <ColorSwatches
            label="Color"
            value={draft.color}
            onChange={(color) => setDraft((d) => ({ ...d, color }))}
          />
        </Group>
        {existing && (
          <p className={styles.muted}>Deleting a tag removes it from people, templates and shifts.</p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

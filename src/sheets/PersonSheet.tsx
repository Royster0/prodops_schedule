import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ColorSwatches, ConfirmDeleteButton, Field, Group, Spacer, TagToggles } from '../components/forms';
import { Sheet } from '../components/Sheet';
import { nextPaletteColor } from '../domain/color';
import { createId } from '../domain/ids';
import { deleteEmployee } from '../domain/manage';
import { nextOrder } from '../domain/shifts';
import type { Employee, ID } from '../domain/types';
import { selectEmployees, selectTags } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './sheets.module.css';

/** Add or edit a person: name, color and tags. */
export function PersonSheet({ employeeId, onClose }: { employeeId?: ID; onClose(): void }) {
  const existing = useScheduleStore((s) => (employeeId ? s.data.employees[employeeId] : undefined));
  const tags = useScheduleStore(selectTags);
  const [draft, setDraft] = useState<Employee>(() => {
    if (existing) return existing;
    const employees = selectEmployees(scheduleStore.getState());
    return {
      id: createId(),
      name: '',
      color: nextPaletteColor(employees.map((e) => e.color)),
      tags: [],
      order: nextOrder(employees),
    };
  });
  const update = (patch: Partial<Employee>) => setDraft((d) => ({ ...d, ...patch }));
  const name = draft.name.trim();

  const save = () => {
    if (!name) return;
    scheduleStore
      .getState()
      .commit(existing ? 'edit person' : 'add person', (changes) =>
        changes.put('employees', { ...draft, name }),
      );
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    scheduleStore.getState().commit('delete person', (changes) => deleteEmployee(changes, existing.id), {
      toast: `Deleted ${existing.name} and their shifts.`,
    });
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit person' : 'Add person'}
      onClose={onClose}
      footer={
        <>
          {existing && <ConfirmDeleteButton onConfirm={remove} />}
          <Spacer />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!name}>
            {existing ? 'Save person' : 'Add person'}
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
        <div className={styles.personHead}>
          <Avatar name={name || '?'} color={draft.color} />
          <Field label="Name" className={styles.grow} error={name ? null : 'Enter a name.'}>
            {(id) => (
              <input
                id={id}
                value={draft.name}
                maxLength={60}
                onChange={(e) => update({ name: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Group label="Color">
          <ColorSwatches label="Color" value={draft.color} onChange={(color) => update({ color })} />
        </Group>
        <Group label="Tags">
          <TagToggles tags={tags} selected={draft.tags} onChange={(ids) => update({ tags: ids })} />
        </Group>
        {existing && (
          <p className={styles.muted}>Deleting a person also removes their shifts and time off.</p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

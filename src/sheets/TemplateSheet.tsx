import { useState } from 'react';
import { Button } from '../components/Button';
import {
  Checkbox,
  ColorSwatches,
  ConfirmDeleteButton,
  Field,
  Group,
  Row,
  Spacer,
  Summary,
  TagToggles,
} from '../components/forms';
import { Sheet } from '../components/Sheet';
import { ShiftBlock } from '../components/ShiftBlock';
import { ChangeSet } from '../domain/changeSet';
import { today } from '../domain/dates';
import { count } from '../domain/format';
import {
  deleteTemplate,
  newTemplateDraft,
  saveTemplate,
  templateTimesChanged,
  upcomingShiftCount,
} from '../domain/manage';
import { endsNextDay, formatHours, isHHMM, shiftHours } from '../domain/time';
import type { ID, Shift, ShiftTemplate } from '../domain/types';
import { selectTags } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './sheets.module.css';

/** Add or edit a shift template, with a live preview of its block. */
export function TemplateSheet({ templateId, onClose }: { templateId?: ID; onClose(): void }) {
  const existing = useScheduleStore((s) => (templateId ? s.data.templates[templateId] : undefined));
  const tags = useScheduleStore(selectTags);
  const tagsById = useScheduleStore((s) => s.data.tags);
  const settings = useScheduleStore((s) => s.data.settings);
  const [draft, setDraft] = useState<ShiftTemplate>(
    () => existing ?? newTemplateDraft(new ChangeSet(scheduleStore.getState().data)),
  );
  const [updateUpcoming, setUpdateUpcoming] = useState(true);
  const update = (patch: Partial<ShiftTemplate>) => setDraft((d) => ({ ...d, ...patch }));

  const from = today();
  const upcoming = existing
    ? upcomingShiftCount(new ChangeSet(scheduleStore.getState().data), existing.id, from)
    : 0;
  const timesChanged = existing ? templateTimesChanged(existing, draft) : false;
  const timesValid = isHHMM(draft.start) && isHHMM(draft.end);
  const hours = timesValid ? shiftHours(draft.start, draft.end, draft.breakMins) : 0;
  const name = draft.name.trim();
  const code = draft.code.trim() || name.slice(0, 3);
  const error = !name
    ? 'Enter a name.'
    : !timesValid
      ? 'Enter a start and end time.'
      : hours === 0
        ? 'The break is as long as the shift. Shorten the break or lengthen the shift.'
        : null;

  const preview: Shift = {
    id: 'preview',
    employeeId: '',
    date: from,
    start: timesValid ? draft.start : '09:00',
    end: timesValid ? draft.end : '17:00',
    breakMins: draft.breakMins,
    templateId: null,
    templateName: '',
    label: name || 'New template',
    color: draft.color,
    tags: draft.tags,
    note: '',
  };

  const save = () => {
    if (error) return;
    const template = { ...draft, name, code };
    const updateFrom = timesChanged && updateUpcoming ? from : null;
    scheduleStore
      .getState()
      .commit(existing ? 'edit template' : 'add template', (changes) =>
        saveTemplate(changes, template, updateFrom),
      );
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    const state = scheduleStore.getState();
    state.commit('delete template', (changes) => deleteTemplate(changes, existing.id), {
      toast: 'Template deleted. Shifts already on the schedule stay as they are.',
    });
    if (state.tool.kind === 'template' && state.tool.templateId === existing.id)
      state.setTool({ kind: 'select' });
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit shift template' : 'New shift template'}
      onClose={onClose}
      footer={
        <>
          {existing && <ConfirmDeleteButton onConfirm={remove} />}
          <Spacer />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={Boolean(error)}>
            {existing ? 'Save template' : 'Add template'}
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
        <div className={styles.templatePreview} aria-hidden="true">
          <ShiftBlock
            shift={preview}
            templates={{}}
            tags={tagsById}
            clock={settings.clock}
            dayStart={settings.dayStart}
            dayEnd={settings.dayEnd}
          />
        </div>
        <Row>
          <Field label="Name">
            {(id) => (
              <input
                id={id}
                value={draft.name}
                maxLength={30}
                onChange={(e) => update({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Code" hint="Up to 3 characters, shown on the palette.">
            {(id) => (
              <input
                id={id}
                value={draft.code}
                maxLength={3}
                placeholder={name.slice(0, 3)}
                onChange={(e) => update({ code: e.target.value.toUpperCase() })}
              />
            )}
          </Field>
        </Row>
        <Row>
          <Field label="Start">
            {(id) => (
              <input
                id={id}
                type="time"
                step={300}
                value={draft.start}
                onChange={(e) => update({ start: e.target.value })}
              />
            )}
          </Field>
          <Field label="End">
            {(id) => (
              <input
                id={id}
                type="time"
                step={300}
                value={draft.end}
                onChange={(e) => update({ end: e.target.value })}
              />
            )}
          </Field>
          <Field label="Break (minutes)">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                step={5}
                value={draft.breakMins}
                onChange={(e) => update({ breakMins: Math.max(0, Number(e.target.value) || 0) })}
              />
            )}
          </Field>
        </Row>
        <Summary>
          <strong>{formatHours(hours)} scheduled</strong>
          {timesValid && endsNextDay(draft.start, draft.end) ? ', ends the next day' : ''}
          {error && <span role="alert">. {error}</span>}
        </Summary>

        {timesChanged && upcoming > 0 && (
          <Checkbox
            label="Also update upcoming shifts that use this template"
            hint={`${count(upcoming, 'shift')} from today onward.`}
            checked={updateUpcoming}
            onChange={setUpdateUpcoming}
          />
        )}

        <Group label="Color">
          <ColorSwatches label="Color" value={draft.color} onChange={(color) => update({ color })} />
        </Group>
        <Group label="Tags">
          <TagToggles tags={tags} selected={draft.tags} onChange={(ids) => update({ tags: ids })} />
        </Group>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

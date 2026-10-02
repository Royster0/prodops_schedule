import { useState } from 'react';
import { Button } from '../components/Button';
import {
  ChoiceChips,
  ColorSwatches,
  ConfirmDeleteButton,
  Field,
  Group,
  Notice,
  Row,
  Spacer,
  Summary,
  TagToggles,
} from '../components/forms';
import { Sheet } from '../components/Sheet';
import { PALETTE, TIME_OFF_LABELS } from '../domain/color';
import { isISODate, today } from '../domain/dates';
import { formatDayLabel } from '../domain/format';
import { createId } from '../domain/ids';
import { endsNextDay, formatHours, fromMinutes, isHHMM, shiftHours, toMinutes } from '../domain/time';
import type { HHMM, ID, ISODate, Shift } from '../domain/types';
import {
  selectEmployees,
  selectPeriod,
  selectTags,
  selectTemplates,
  selectVisibleIds,
} from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';

interface ShiftSheetProps {
  shiftId?: ID;
  employeeId?: ID;
  date?: ISODate;
  start?: HHMM;
  onClose(): void;
}

const ONE_OFF = 'one-off';

interface Draft {
  employeeId: ID;
  date: ISODate;
  source: ID | typeof ONE_OFF;
  start: HHMM;
  end: HHMM;
  breakMins: number;
  label: string;
  color: string;
  tags: ID[];
  note: string;
}

/** Picks sensible defaults for a new shift from what was clicked and what is shown. */
function newDraft(props: ShiftSheetProps): Draft {
  const state = scheduleStore.getState();
  const templates = selectTemplates(state);
  const period = selectPeriod(state);
  const visible = selectVisibleIds(state);
  const selected = visible.find((id) => state.selectedIds.has(id));
  const now = today();
  const date = props.date ?? (period.start <= now && now <= period.end ? now : period.start);
  const base = {
    employeeId: props.employeeId ?? selected ?? visible[0] ?? selectEmployees(state)[0]?.id ?? '',
    date,
    label: '',
    tags: [],
    note: '',
  };
  const first = templates[0];
  if (props.start || !first) {
    const start = props.start ?? '09:00';
    return {
      ...base,
      source: ONE_OFF,
      start,
      end: fromMinutes(toMinutes(start) + 8 * 60 + 30),
      breakMins: 30,
      color: PALETTE[10],
    };
  }
  return {
    ...base,
    source: first.id,
    start: first.start,
    end: first.end,
    breakMins: first.breakMins,
    color: first.color,
  };
}

function draftFromShift(shift: Shift, templateExists: boolean): Draft {
  return {
    employeeId: shift.employeeId,
    date: shift.date,
    source: shift.templateId && templateExists ? shift.templateId : ONE_OFF,
    start: shift.start,
    end: shift.end,
    breakMins: shift.breakMins,
    label: shift.label,
    color: shift.color,
    tags: shift.tags,
    note: shift.note,
  };
}

/** Add or edit one shift: person, date, times, label, color, tags and a note. */
export function ShiftSheet(props: ShiftSheetProps) {
  const existing = useScheduleStore((s) => (props.shiftId ? s.data.shifts[props.shiftId] : undefined));
  const templatesById = useScheduleStore((s) => s.data.templates);
  const templates = useScheduleStore(selectTemplates);
  const employees = useScheduleStore(selectEmployees);
  const tags = useScheduleStore(selectTags);
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? draftFromShift(existing, Boolean(existing.templateId && templatesById[existing.templateId]))
      : newDraft(props),
  );
  const timeOff = useScheduleStore((s) =>
    Object.values(s.data.timeOff).find(
      (t) => t.employeeId === draft.employeeId && t.start <= draft.date && draft.date <= t.end,
    ),
  );
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  if (props.shiftId && !existing) {
    return (
      <Sheet title="Shift not found" onClose={props.onClose}>
        <p>This shift was deleted.</p>
      </Sheet>
    );
  }

  const template = draft.source === ONE_OFF ? undefined : templatesById[draft.source];
  const person = employees.find((e) => e.id === draft.employeeId);
  const timesValid = isHHMM(draft.start) && isHHMM(draft.end);
  const hours = timesValid ? shiftHours(draft.start, draft.end, draft.breakMins) : 0;
  const error = !person
    ? 'Pick a person.'
    : !isISODate(draft.date)
      ? 'Pick a date.'
      : !timesValid
        ? 'Enter a start and end time.'
        : hours === 0
          ? 'The break is as long as the shift. Shorten the break or lengthen the shift.'
          : null;

  const chooseSource = (source: string) => {
    const next = templatesById[source];
    if (next) update({ source: next.id, start: next.start, end: next.end, breakMins: next.breakMins });
    else update({ source: ONE_OFF });
  };

  const save = () => {
    if (error) return;
    const shift: Shift = {
      id: existing?.id ?? createId(),
      employeeId: draft.employeeId,
      date: draft.date,
      start: draft.start,
      end: draft.end,
      breakMins: draft.breakMins,
      templateId: template ? template.id : null,
      templateName: template ? template.name : '',
      label: draft.label.trim(),
      color: template ? template.color : draft.color,
      tags: draft.tags,
      note: draft.note.trim(),
    };
    scheduleStore
      .getState()
      .commit(existing ? 'edit shift' : 'add shift', (changes) => changes.put('shifts', shift));
    props.onClose();
  };

  const remove = () => {
    if (!existing) return;
    scheduleStore.getState().commit('delete shift', (changes) => changes.remove('shifts', existing.id), {
      toast: 'Deleted the shift.',
    });
    props.onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit shift' : 'Add shift'}
      onClose={props.onClose}
      footer={
        <>
          {existing && <ConfirmDeleteButton onConfirm={remove} />}
          <Spacer />
          <Button onClick={props.onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={Boolean(error)}>
            {existing ? 'Save shift' : 'Add shift'}
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
        <Row>
          <Field label="Person">
            {(id) => (
              <select
                id={id}
                value={draft.employeeId}
                onChange={(e) => update({ employeeId: e.target.value })}
              >
                {!person && <option value="">Pick a person</option>}
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Date">
            {(id) => (
              <input
                id={id}
                type="date"
                value={draft.date}
                required
                onChange={(e) => update({ date: e.target.value })}
              />
            )}
          </Field>
        </Row>

        {timeOff && (
          <Notice tone="warning">
            {person?.name} has {TIME_OFF_LABELS[timeOff.type].toLowerCase()} time off on{' '}
            {formatDayLabel(draft.date)}. The shift will show a warning.
          </Notice>
        )}

        <Group label="Start from">
          <ChoiceChips
            label="Start from"
            value={draft.source}
            onChange={chooseSource}
            choices={[
              { value: ONE_OFF, label: 'One-off' },
              ...templates.map((t) => ({ value: t.id, label: t.name, color: t.color })),
            ]}
          />
        </Group>

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
                max={240}
                step={5}
                inputMode="numeric"
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

        <Field
          label="Label"
          hint={
            template ? `Leave empty to show "${template.name}".` : 'Shown on the block instead of "Shift".'
          }
        >
          {(id) => (
            <input
              id={id}
              value={draft.label}
              maxLength={40}
              placeholder={template ? template.name : 'e.g. Inventory count'}
              onChange={(e) => update({ label: e.target.value })}
            />
          )}
        </Field>

        {!template && (
          <Group label="Color">
            <ColorSwatches label="Color" value={draft.color} onChange={(color) => update({ color })} />
          </Group>
        )}

        <Group label="Tags">
          <TagToggles tags={tags} selected={draft.tags} onChange={(ids) => update({ tags: ids })} />
        </Group>

        <Field label="Note">
          {(id) => (
            <textarea
              id={id}
              rows={2}
              value={draft.note}
              maxLength={500}
              onChange={(e) => update({ note: e.target.value })}
            />
          )}
        </Field>

        {/* Lets Enter in a text field submit the form. */}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

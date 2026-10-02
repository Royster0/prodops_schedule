import { useState } from 'react';
import { Button } from '../components/Button';
import {
  Checkbox,
  ChoiceChips,
  ConfirmDeleteButton,
  Field,
  Group,
  Notice,
  Row,
  Spacer,
  Summary,
} from '../components/forms';
import { Sheet } from '../components/Sheet';
import { TIME_OFF_COLORS, TIME_OFF_LABELS, TIME_OFF_TYPES } from '../domain/color';
import { isISODate, overlapDays, today } from '../domain/dates';
import { count } from '../domain/format';
import { addRange, rangeLength, updateRange } from '../domain/timeOff';
import type { ID, ISODate, TimeOffType } from '../domain/types';
import { selectEmployees, selectVisibleIds } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';

interface TimeOffSheetProps {
  timeOffId?: ID;
  employeeId?: ID;
  date?: ISODate;
  type?: TimeOffType;
  onClose(): void;
}

interface Draft {
  employeeId: ID;
  type: TimeOffType;
  start: ISODate;
  end: ISODate;
  note: string;
  removeShifts: boolean;
}

const TYPE_CHOICES = TIME_OFF_TYPES.map((type) => ({
  value: type,
  label: TIME_OFF_LABELS[type],
  color: TIME_OFF_COLORS[type],
  hatch: true,
}));

/** Add or edit a time off range for one person. */
export function TimeOffSheet(props: TimeOffSheetProps) {
  const existing = useScheduleStore((s) => (props.timeOffId ? s.data.timeOff[props.timeOffId] : undefined));
  const employees = useScheduleStore(selectEmployees);
  const allTimeOff = useScheduleStore((s) => s.data.timeOff);
  const shiftsById = useScheduleStore((s) => s.data.shifts);
  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) return { ...existing, removeShifts: true };
    const state = scheduleStore.getState();
    const visible = selectVisibleIds(state);
    const date = props.date ?? today();
    return {
      employeeId: props.employeeId ?? visible.find((id) => state.selectedIds.has(id)) ?? visible[0] ?? '',
      type: props.type ?? 'vacation',
      start: date,
      end: date,
      note: '',
      removeShifts: true,
    };
  });
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  if (props.timeOffId && !existing) {
    return (
      <Sheet title="Time off not found" onClose={props.onClose}>
        <p>This time off was removed.</p>
      </Sheet>
    );
  }

  const person = employees.find((e) => e.id === draft.employeeId);
  const datesValid = isISODate(draft.start) && isISODate(draft.end);
  const error = !person
    ? 'Pick a person.'
    : !datesValid
      ? 'Pick both dates.'
      : draft.end < draft.start
        ? 'The end date is before the start date. Pick a later end date.'
        : null;

  const overlapping = error
    ? 0
    : Object.values(allTimeOff).filter(
        (t) =>
          t.id !== existing?.id &&
          t.employeeId === draft.employeeId &&
          overlapDays(t.start, t.end, draft.start, draft.end) > 0,
      ).length;
  const shiftsInRange = error
    ? 0
    : Object.values(shiftsById).filter(
        (s) => s.employeeId === draft.employeeId && draft.start <= s.date && s.date <= draft.end,
      ).length;

  const save = () => {
    if (error) return;
    const input = {
      employeeId: draft.employeeId,
      start: draft.start,
      end: draft.end,
      type: draft.type,
      note: draft.note.trim(),
    };
    scheduleStore
      .getState()
      .commit(existing ? 'edit time off' : 'add time off', (changes) =>
        existing
          ? updateRange(changes, existing.id, input, draft.removeShifts)
          : addRange(changes, input, draft.removeShifts),
      );
    props.onClose();
  };

  const remove = () => {
    if (!existing) return;
    scheduleStore
      .getState()
      .commit('remove time off', (changes) => changes.remove('timeOff', existing.id), {
        toast: 'Removed the time off.',
      });
    props.onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit time off' : 'Add time off'}
      onClose={props.onClose}
      footer={
        <>
          {existing && <ConfirmDeleteButton onConfirm={remove} label="Remove" />}
          <Spacer />
          <Button onClick={props.onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={Boolean(error)}>
            {existing ? 'Save time off' : 'Add time off'}
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
        <Field label="Person">
          {(id) => (
            <select id={id} value={draft.employeeId} onChange={(e) => update({ employeeId: e.target.value })}>
              {!person && <option value="">Pick a person</option>}
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Group label="Type">
          <ChoiceChips
            label="Type"
            choices={TYPE_CHOICES}
            value={draft.type}
            onChange={(type) => update({ type })}
          />
        </Group>

        <Row>
          <Field label="From">
            {(id) => (
              <input
                id={id}
                type="date"
                value={draft.start}
                onChange={(e) => {
                  const start = e.target.value;
                  update({ start, end: draft.end < start ? start : draft.end });
                }}
              />
            )}
          </Field>
          <Field label="Through">
            {(id) => (
              <input
                id={id}
                type="date"
                value={draft.end}
                min={draft.start}
                onChange={(e) => update({ end: e.target.value })}
              />
            )}
          </Field>
        </Row>
        <Summary>
          {error ? (
            <span role="alert">{error}</span>
          ) : (
            <strong>{count(rangeLength(draft.start, draft.end), 'day')}</strong>
          )}
        </Summary>

        {overlapping > 0 && (
          <Notice>
            This replaces the overlapping days of{' '}
            {count(overlapping, 'other time off range', 'other time off ranges')}.
          </Notice>
        )}

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

        <Checkbox
          label="Remove their shifts on these days"
          checked={draft.removeShifts}
          onChange={(removeShifts) => update({ removeShifts })}
          hint={
            shiftsInRange > 0 ? `${count(shiftsInRange, 'shift')} in this range.` : 'No shifts in this range.'
          }
        />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

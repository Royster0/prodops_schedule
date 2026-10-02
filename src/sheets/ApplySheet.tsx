import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import {
  ActionChips,
  Checkbox,
  ChoiceChips,
  ColorSwatches,
  Field,
  Group,
  Notice,
  Row,
  Spacer,
  ToggleChips,
} from '../components/forms';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import {
  WEEKDAYS_MON_TO_FRI,
  appliedMessage,
  applyButtonLabel,
  applyShifts,
  describeApply,
  isNoOp,
  planApply,
  type ApplyRequest,
  type ApplyWhat,
} from '../domain/apply';
import { PALETTE, TIME_OFF_COLORS, TIME_OFF_LABELS, TIME_OFF_TYPES } from '../domain/color';
import { WEEKDAY_SHORT, addDays } from '../domain/dates';
import { count } from '../domain/format';
import type { HHMM, ID, ISODate, TimeOffType } from '../domain/types';
import {
  selectEmployees,
  selectPatterns,
  selectPeriod,
  selectTags,
  selectTemplates,
  selectVisibleIds,
} from '../store/derived';
import type { ApplyPreset } from '../store/types';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import { PatternPreview } from './PatternPreview';
import styles from './sheets.module.css';

type Mode = 'shift' | 'pattern' | 'timeOff';
type Who = 'one' | 'selected' | 'shown' | 'tag';
const CUSTOM = 'custom';

interface Form {
  mode: Mode;
  /** A template id, or 'custom' for custom times. */
  shiftSource: ID;
  custom: { start: HHMM; end: HHMM; breakMins: number; label: string; color: string };
  patternId: ID;
  timeOff: { type: TimeOffType; note: string; removeShifts: boolean };
  who: Who;
  employeeId: ID;
  tagId: ID;
  from: ISODate;
  to: ISODate;
  weekdays: number[];
  conflict: 'replace' | 'keep';
  skipHolidays: boolean;
}

const MODE_OPTIONS = [
  { value: 'shift', label: 'Shift' },
  { value: 'pattern', label: 'Work pattern' },
  { value: 'timeOff', label: 'Time off' },
] as const;

function initialForm(preset: ApplyPreset = {}): Form {
  const state = scheduleStore.getState();
  const templates = selectTemplates(state);
  const patterns = selectPatterns(state);
  const period = selectPeriod(state);
  const visible = selectVisibleIds(state);
  const anySelected = visible.some((id) => state.selectedIds.has(id));
  const mode: Mode = preset.mode === 'pattern' ? 'pattern' : preset.mode === 'timeOff' ? 'timeOff' : 'shift';
  return {
    mode,
    shiftSource: preset.mode === 'custom' ? CUSTOM : (preset.templateId ?? templates[0]?.id ?? CUSTOM),
    custom: { start: '09:00', end: '17:30', breakMins: 30, label: '', color: PALETTE[10] },
    patternId: preset.patternId ?? patterns[0]?.id ?? '',
    timeOff: { type: 'vacation', note: '', removeShifts: true },
    who: preset.who ?? (anySelected ? 'selected' : 'shown'),
    employeeId: preset.employeeId ?? visible[0] ?? '',
    tagId: selectTags(state)[0]?.id ?? '',
    from: preset.from ?? period.start,
    to: preset.to ?? preset.from ?? period.end,
    // A preset date range (e.g. one tapped day) should not be filtered by weekday.
    weekdays: preset.from ? [0, 1, 2, 3, 4, 5, 6] : [...WEEKDAYS_MON_TO_FRI],
    conflict: 'replace',
    skipHolidays: true,
  };
}

/** Apply a shift, custom times, a work pattern or time off to many people over any dates. */
export function ApplySheet({ preset, onClose }: { preset?: ApplyPreset; onClose(): void }) {
  const data = useScheduleStore((s) => s.data);
  const templates = useScheduleStore(selectTemplates);
  const patterns = useScheduleStore(selectPatterns);
  const employees = useScheduleStore(selectEmployees);
  const tags = useScheduleStore(selectTags);
  const visibleIds = useScheduleStore(selectVisibleIds);
  const selectedIds = useScheduleStore((s) => s.selectedIds);
  const period = useScheduleStore(selectPeriod);
  const [form, setForm] = useState<Form>(() => initialForm(preset));
  const update = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const selected = visibleIds.filter((id) => selectedIds.has(id));
  const targets = useMemo((): ID[] => {
    switch (form.who) {
      case 'one':
        return form.employeeId ? [form.employeeId] : [];
      case 'selected':
        return selected;
      case 'shown':
        return [...visibleIds];
      case 'tag':
        return employees.filter((e) => e.tags.includes(form.tagId)).map((e) => e.id);
    }
  }, [form.who, form.employeeId, form.tagId, selected, visibleIds, employees]);

  const what: ApplyWhat =
    form.mode === 'pattern'
      ? { kind: 'pattern', patternId: form.patternId }
      : form.mode === 'timeOff'
        ? { kind: 'timeOff', ...form.timeOff }
        : form.shiftSource === CUSTOM
          ? { kind: 'custom', ...form.custom }
          : { kind: 'template', templateId: form.shiftSource };

  const request: ApplyRequest = {
    what,
    employeeIds: targets,
    from: form.from,
    to: form.to,
    weekdays: form.weekdays,
    conflict: form.conflict,
    skipHolidays: form.skipHolidays,
  };
  const plan = planApply(data, request);
  const noOp = !plan.error && isNoOp(request, plan.result);

  const apply = () => {
    if (plan.error || noOp) return;
    scheduleStore.getState().commit('apply shifts', (changes) => applyShifts(changes, request), {
      toast: (result) => appliedMessage(request, result),
    });
    onClose();
  };

  const setRangeWeeks = (weeks: number) => update({ to: addDays(form.from, weeks * 7 - 1) });
  const weekdayOrder = data.settings.weekStart === 1 ? [0, 1, 2, 3, 4, 5, 6] : [6, 0, 1, 2, 3, 4, 5];
  const pattern = data.patterns[form.patternId];

  return (
    <Sheet
      title="Apply shifts"
      onClose={onClose}
      footer={
        <>
          <Spacer />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={apply} disabled={Boolean(plan.error) || noOp}>
            {noOp ? 'Nothing to apply' : applyButtonLabel(request, plan.result)}
          </Button>
        </>
      }
    >
      <Group label="What">
        <Segmented
          label="What"
          options={MODE_OPTIONS}
          value={form.mode}
          onChange={(mode) => update({ mode })}
          stretch
        />
      </Group>

      {form.mode === 'shift' && (
        <>
          <Field label="Shift">
            {(id) => (
              <select
                id={id}
                value={form.shiftSource}
                onChange={(e) => update({ shiftSource: e.target.value })}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                <option value={CUSTOM}>Custom times</option>
              </select>
            )}
          </Field>
          {form.shiftSource === CUSTOM && (
            <div className={styles.inset}>
              <Row>
                <Field label="Start">
                  {(id) => (
                    <input
                      id={id}
                      type="time"
                      step={300}
                      value={form.custom.start}
                      onChange={(e) => update({ custom: { ...form.custom, start: e.target.value } })}
                    />
                  )}
                </Field>
                <Field label="End">
                  {(id) => (
                    <input
                      id={id}
                      type="time"
                      step={300}
                      value={form.custom.end}
                      onChange={(e) => update({ custom: { ...form.custom, end: e.target.value } })}
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
                      value={form.custom.breakMins}
                      onChange={(e) =>
                        update({
                          custom: { ...form.custom, breakMins: Math.max(0, Number(e.target.value) || 0) },
                        })
                      }
                    />
                  )}
                </Field>
              </Row>
              <Field label="Label">
                {(id) => (
                  <input
                    id={id}
                    value={form.custom.label}
                    maxLength={40}
                    placeholder="e.g. Inventory count"
                    onChange={(e) => update({ custom: { ...form.custom, label: e.target.value } })}
                  />
                )}
              </Field>
              <Group label="Color">
                <ColorSwatches
                  label="Color"
                  value={form.custom.color}
                  onChange={(color) => update({ custom: { ...form.custom, color } })}
                />
              </Group>
            </div>
          )}
        </>
      )}

      {form.mode === 'pattern' && (
        <>
          <Field label="Work pattern">
            {(id) =>
              patterns.length === 0 ? (
                <p id={id} className={styles.muted}>
                  No patterns yet. Add one under Manage, Patterns.
                </p>
              ) : (
                <select
                  id={id}
                  value={form.patternId}
                  onChange={(e) => update({ patternId: e.target.value })}
                >
                  {patterns.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )
            }
          </Field>
          {pattern && (
            <PatternPreview
              pattern={pattern}
              templates={data.templates}
              weekStart={data.settings.weekStart}
            />
          )}
        </>
      )}

      {form.mode === 'timeOff' && (
        <>
          <Group label="Type">
            <ChoiceChips
              label="Type"
              value={form.timeOff.type}
              onChange={(type) => update({ timeOff: { ...form.timeOff, type } })}
              choices={TIME_OFF_TYPES.map((type) => ({
                value: type,
                label: TIME_OFF_LABELS[type],
                color: TIME_OFF_COLORS[type],
                hatch: true,
              }))}
            />
          </Group>
          <Field label="Note">
            {(id) => (
              <input
                id={id}
                value={form.timeOff.note}
                maxLength={200}
                onChange={(e) => update({ timeOff: { ...form.timeOff, note: e.target.value } })}
              />
            )}
          </Field>
        </>
      )}

      <Group label="Who">
        <ChoiceChips
          label="Who"
          value={form.who}
          onChange={(who) => update({ who })}
          choices={[
            { value: 'one', label: 'One person' },
            { value: 'selected', label: `Selected (${selected.length})` },
            { value: 'shown', label: `Everyone shown (${visibleIds.length})` },
            { value: 'tag', label: 'By tag' },
          ]}
        />
      </Group>
      {form.who === 'one' && (
        <Field label="Person">
          {(id) => (
            <select id={id} value={form.employeeId} onChange={(e) => update({ employeeId: e.target.value })}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {form.who === 'tag' && (
        <Field label="Tag" hint={`${count(targets.length, 'person', 'people')} with this tag.`}>
          {(id) => (
            <select id={id} value={form.tagId} onChange={(e) => update({ tagId: e.target.value })}>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Row>
        <Field label="From">
          {(id) => (
            <input id={id} type="date" value={form.from} onChange={(e) => update({ from: e.target.value })} />
          )}
        </Field>
        <Field label="Through">
          {(id) => (
            <input id={id} type="date" value={form.to} onChange={(e) => update({ to: e.target.value })} />
          )}
        </Field>
      </Row>
      <div className={styles.quickChips}>
        <ActionChips
          label="Quick dates"
          actions={[
            { label: 'Dates shown', onClick: () => update({ from: period.start, to: period.end }) },
            { label: '4 weeks', onClick: () => setRangeWeeks(4) },
            { label: '12 weeks', onClick: () => setRangeWeeks(12) },
            { label: '26 weeks', onClick: () => setRangeWeeks(26) },
          ]}
        />
      </div>

      {form.mode === 'shift' && (
        <Group label="On these days">
          <ToggleChips
            label="On these days"
            selected={form.weekdays.map(String)}
            onChange={(ids) => update({ weekdays: ids.map(Number) })}
            options={weekdayOrder.map((i) => ({ id: String(i), label: WEEKDAY_SHORT[(i + 1) % 7] }))}
          />
        </Group>
      )}

      {form.mode !== 'timeOff' ? (
        <>
          <Group label="If someone already has a shift that day">
            <ChoiceChips
              label="If someone already has a shift that day"
              value={form.conflict}
              onChange={(conflict) => update({ conflict })}
              choices={[
                { value: 'replace', label: 'Replace it' },
                { value: 'keep', label: 'Keep it' },
              ]}
            />
          </Group>
          <Checkbox
            label="Skip holidays"
            checked={form.skipHolidays}
            onChange={(skipHolidays) => update({ skipHolidays })}
          />
        </>
      ) : (
        <Checkbox
          label="Remove their shifts on these days"
          checked={form.timeOff.removeShifts}
          onChange={(removeShifts) => update({ timeOff: { ...form.timeOff, removeShifts } })}
        />
      )}

      <div aria-live="polite">
        {plan.error ? (
          <Notice tone="warning">{plan.error}</Notice>
        ) : (
          <Notice>{describeApply(request, plan.result, data, data.settings.clock)}</Notice>
        )}
      </div>
    </Sheet>
  );
}

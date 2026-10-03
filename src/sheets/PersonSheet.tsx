import { useState } from 'react';
import { useAccount } from '../auth/account';
import { ACCESS_LABELS, usePeopleAccess, type PersonAccess } from '../auth/peopleAccess';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import {
  ColorSwatches,
  ConfirmDeleteButton,
  Field,
  Group,
  Notice,
  Spacer,
  TagToggles,
} from '../components/forms';
import { Sheet } from '../components/Sheet';
import { nextPaletteColor } from '../domain/color';
import { createId } from '../domain/ids';
import { appUrl, type ScheduleRole } from '../data/supabaseRepository';
import { deleteEmployee } from '../domain/manage';
import { nextOrder } from '../domain/shifts';
import type { Employee, ID } from '../domain/types';
import { selectEmployees, selectTags } from '../store/derived';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './sheets.module.css';

interface SignInDraft {
  email: string;
  role: ScheduleRole;
}

/** Add or edit a person: name, color and tags, and for the owner, who signs in as them. */
export function PersonSheet({ employeeId, onClose }: { employeeId?: ID; onClose(): void }) {
  const existing = useScheduleStore((s) => (employeeId ? s.data.employees[employeeId] : undefined));
  const tags = useScheduleStore(selectTags);
  const account = useAccount();
  const isOwner = !!account?.repository.isOwner;
  const { access } = usePeopleAccess();
  const linked = employeeId ? access?.byPerson[employeeId] : undefined;
  // Untouched until the owner edits it, so it follows the sign-in as it loads.
  const [signInDraft, setSignInDraft] = useState<SignInDraft | null>(null);
  const signIn = signInDraft ?? { email: linked?.email ?? '', role: linked?.role ?? 'viewer' };
  const [saving, setSaving] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
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

  const email = signIn.email.trim().toLowerCase();
  const signInChanged =
    isOwner &&
    signInDraft !== null &&
    (email !== (linked?.email ?? '') || (!!email && signIn.role !== linked?.role));

  const save = async () => {
    if (!name || saving) return;
    const { commit, showToast } = scheduleStore.getState();
    commit(existing ? 'edit person' : 'add person', (changes) =>
      changes.put('employees', { ...draft, name }),
    );
    if (account && signInChanged) {
      setSaving(true);
      setSignInError(null);
      try {
        const result = await account.repository.assignPerson(draft.id, email, signIn.role);
        if (result === 'invited') {
          try {
            await account.repository.sendInviteEmail(email);
            showToast(`Sent ${email} a sign-in link. They get access when they use it.`);
          } catch {
            showToast(`Saved. The email to ${email} didn't go out, so send them ${appUrl()}.`);
          }
        } else if (result === 'unlinked') {
          showToast(`No one signs in as ${name} now. Their account can still view.`);
        }
      } catch (error) {
        setSaving(false);
        setSignInError(error instanceof Error ? error.message : String(error));
        return;
      }
    }
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
          <Button variant="primary" onClick={() => void save()} disabled={!name || saving}>
            {saving ? 'Saving…' : existing ? 'Save person' : 'Add person'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
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
        {account &&
          (isOwner ? (
            <SignInFields
              value={signIn}
              linked={linked}
              suggestions={access?.memberEmails ?? []}
              error={signInError}
              onChange={(next) => {
                setSignInDraft(next);
                setSignInError(null);
              }}
            />
          ) : (
            linked && (
              <p className={styles.muted}>
                Signs in as {linked.email} · {linked.owner ? 'Owner' : ACCESS_LABELS[linked.role]}
                {linked.invited && ' (invited)'}
              </p>
            )
          ))}
        {existing && (
          <p className={styles.muted}>Deleting a person also removes their shifts and time off.</p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

/** The owner links a sign-in email to this person and picks what they can do. */
function SignInFields({
  value,
  linked,
  suggestions,
  error,
  onChange,
}: {
  value: SignInDraft;
  linked: PersonAccess | undefined;
  suggestions: string[];
  error: string | null;
  onChange(next: SignInDraft): void;
}) {
  const hasEmail = !!value.email.trim();
  const isOwnerRow = linked?.owner && value.email.trim().toLowerCase() === linked.email;
  return (
    <>
      <div className={styles.signInRow}>
        <Field
          label="Signs in as"
          className={styles.grow}
          hint={
            linked?.invited
              ? 'Invited. They get this access when they sign in with this email.'
              : 'Pick someone who has signed in, or type any email to invite them.'
          }
        >
          {(id) => (
            <>
              <input
                id={id}
                type="email"
                autoComplete="off"
                list={`${id}-emails`}
                placeholder="No one yet"
                value={value.email}
                onChange={(e) => onChange({ ...value, email: e.target.value })}
              />
              <datalist id={`${id}-emails`}>
                {suggestions.map((email) => (
                  <option key={email} value={email} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Access">
          {(id) =>
            isOwnerRow ? (
              <select id={id} disabled value="owner">
                <option value="owner">Owner</option>
              </select>
            ) : (
              <select
                id={id}
                disabled={!hasEmail}
                value={value.role}
                onChange={(e) => onChange({ ...value, role: e.target.value as ScheduleRole })}
              >
                <option value="editor">{ACCESS_LABELS.editor}</option>
                <option value="viewer">{ACCESS_LABELS.viewer}</option>
              </select>
            )
          }
        </Field>
      </div>
      {error && <Notice tone="warning">{error}</Notice>}
    </>
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAccount, type Account } from '../../auth/account';
import { Button } from '../../components/Button';
import { Checkbox, Field, Notice } from '../../components/forms';
import { takeLocalSchedule } from '../../data/localStorageRepository';
import { appUrl, type ScheduleMembership, type ScheduleRole } from '../../data/supabaseRepository';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import styles from './manage.module.css';

interface Member {
  user_id: string;
  email: string;
  role: ScheduleRole;
  employee_id: string | null;
}

interface Invite {
  email: string;
  role: ScheduleRole;
  employee_id: string | null;
}

interface Team {
  members: Member[];
  invites: Invite[];
  /** Anyone who signs in can view it. */
  open: boolean;
}

async function fetchTeam(client: SupabaseClient, scheduleId: string): Promise<Team | null> {
  const [m, i, s] = await Promise.all([
    client
      .from('schedule_members')
      .select('user_id, email, role, employee_id')
      .eq('schedule_id', scheduleId)
      .order('joined_at'),
    client
      .from('schedule_invites')
      .select('email, role, employee_id')
      .eq('schedule_id', scheduleId)
      .order('created_at'),
    client.from('schedules').select('open_to_signed_in').eq('id', scheduleId).single(),
  ]);
  if (m.error || i.error || s.error) return null;
  return {
    members: m.data as Member[],
    invites: i.data as Invite[],
    open: !!(s.data as { open_to_signed_in?: boolean }).open_to_signed_in,
  };
}

const ROLE_LABELS: Record<ScheduleRole, string> = { editor: 'Can edit', viewer: 'Can view' };

/** Sharing, the person's other schedules, and their account. Only shown when signed in. */
export function AccountSection() {
  const account = useAccount();
  if (!account) return null;
  return (
    <>
      <div className={styles.divider} />
      <h3 className={styles.section}>Sharing</h3>
      <TeamList account={account} />
      <ScheduleSwitcher account={account} />

      <div className={styles.divider} />
      <h3 className={styles.section}>Account</h3>
      <p className={styles.sectionHint}>Signed in as {account.email}.</p>
      <div className={styles.toolbar}>
        <Button onClick={() => void account.signOut()}>Sign out</Button>
      </div>
    </>
  );
}

function TeamList({ account }: { account: Account }) {
  const repo = account.repository;
  const client = repo.client;
  const scheduleId = repo.scheduleId;
  const isOwner = repo.isOwner;
  const [team, setTeam] = useState<Team | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ScheduleRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const employees = useScheduleStore((s) => s.data.employees);
  const personName = (id: string | null) => (id ? employees[id]?.name : undefined);

  const show = useCallback((next: Team | null) => {
    if (next) setTeam(next);
    else setError("Couldn't load who has access. Check your connection.");
  }, []);

  const refresh = useCallback(() => {
    if (scheduleId) void fetchTeam(client, scheduleId).then(show);
  }, [client, scheduleId, show]);

  useEffect(() => {
    let active = true;
    if (scheduleId) {
      void fetchTeam(client, scheduleId).then((next) => {
        if (active) show(next);
      });
    }
    return () => {
      active = false;
    };
  }, [client, scheduleId, show]);

  const run = async (request: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: requestError } = await request;
    setError(requestError ? requestError.message : null);
    refresh();
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address || !scheduleId) return;
    if (team?.members.some((m) => m.email === address)) {
      setError(`${address} already has access. Change their access in the list above.`);
      return;
    }
    const { error: inviteError } = await client
      .from('schedule_invites')
      .upsert({ schedule_id: scheduleId, email: address, role }, { onConflict: 'schedule_id,email' });
    if (inviteError) {
      setError(
        /check constraint/i.test(inviteError.message) ? 'Enter a full email address.' : inviteError.message,
      );
      return;
    }
    setError(null);
    setEmail('');
    refresh();
    await sendEmail(address);
  };

  const sendEmail = async (address: string) => {
    setSent(null);
    try {
      await repo.sendInviteEmail(address);
      setSent(`Sent ${address} a sign-in link. They get access as soon as they use it.`);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      setError(
        /rate limit|security purposes|seconds/i.test(message)
          ? `The invite is saved, but too many emails went out just now. Try Resend in a minute, or send ${address} the link below.`
          : `The invite is saved, but the email couldn't be sent (${message}). Send ${address} the link below instead.`,
      );
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Copy this address and send it: ${appUrl()}`);
    }
  };

  const setOpen = async (open: boolean) => {
    setTeam((current) => current && { ...current, open });
    try {
      await repo.setOpenToSignedIn(open);
      setError(null);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
    refresh();
  };

  const leave = async () => {
    if (!scheduleId) return;
    const { error: leaveError } = await client
      .from('schedule_members')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('user_id', account.userId);
    if (leaveError) {
      setError(leaveError.message);
      return;
    }
    window.location.reload();
  };

  if (!team) return error ? <Notice tone="warning">{error}</Notice> : null;

  const owner = team.members.find((m) => m.user_id === repo.ownerId);
  const others = team.members.filter((m) => m !== owner);

  return (
    <>
      <p className={styles.sectionHint}>
        {isOwner
          ? 'You own this schedule. You decide who can see it and who can change it.'
          : `${owner ? owner.email : 'The owner'} owns this schedule and decides who can see or change it. You ${
              repo.readOnly ? 'can view it' : 'can edit it'
            }.`}
      </p>
      <ul className={styles.list}>
        {owner && (
          <li className={styles.item}>
            <span className={styles.main}>
              <span className={styles.name}>{owner.email || 'Owner'}</span>
              <span className={styles.meta}>
                Owner{owner.user_id === account.userId && ' · you'}
                {personName(owner.employee_id) && ` · ${personName(owner.employee_id)}`}
              </span>
            </span>
          </li>
        )}
        {others.map((m) => (
          <li key={m.user_id} className={styles.item}>
            <span className={styles.main}>
              <span className={styles.name}>{m.email || 'Teammate'}</span>
              <span className={styles.meta}>
                {isOwner
                  ? (personName(m.employee_id) ?? 'Not linked to anyone on the schedule')
                  : [ROLE_LABELS[m.role], personName(m.employee_id), m.user_id === account.userId && 'you']
                      .filter(Boolean)
                      .join(' · ')}
              </span>
            </span>
            {isOwner && (
              <span className={styles.actions}>
                <select
                  aria-label={`Access for ${m.email}`}
                  className={styles.roleSelect}
                  value={m.role}
                  onChange={(e) =>
                    void run(
                      client
                        .from('schedule_members')
                        .update({ role: e.target.value })
                        .eq('schedule_id', scheduleId!)
                        .eq('user_id', m.user_id),
                    )
                  }
                >
                  <option value="editor">{ROLE_LABELS.editor}</option>
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void run(
                      client
                        .from('schedule_members')
                        .delete()
                        .eq('schedule_id', scheduleId!)
                        .eq('user_id', m.user_id),
                    )
                  }
                >
                  Remove
                </Button>
              </span>
            )}
          </li>
        ))}
        {team.invites.map((i) => (
          <li key={i.email} className={styles.item}>
            <span className={styles.main}>
              <span className={styles.name}>{i.email}</span>
              <span className={styles.meta}>
                Invited{personName(i.employee_id) && ` as ${personName(i.employee_id)}`} ·{' '}
                {ROLE_LABELS[i.role].toLowerCase()} once they sign in with this email
              </span>
            </span>
            {isOwner && (
              <span className={styles.actions}>
                <Button variant="ghost" size="sm" onClick={() => void sendEmail(i.email)}>
                  Resend
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void run(
                      client
                        .from('schedule_invites')
                        .delete()
                        .eq('schedule_id', scheduleId!)
                        .eq('email', i.email),
                    )
                  }
                >
                  Cancel
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <Checkbox
          label="Anyone who signs in can view this schedule"
          checked={team.open}
          onChange={(open) => void setOpen(open)}
          hint={
            team.open
              ? "Accounts you haven't linked to someone on the schedule get view only. Link people in People, or change access here."
              : 'Only people you invite or link to someone on the schedule can see it.'
          }
        />
      )}
      {isOwner ? (
        <form className={styles.addRow} onSubmit={invite}>
          <Field label="Invite by email">
            {(id) => (
              <input
                id={id}
                type="email"
                autoComplete="off"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Access">
            {(id) => (
              <select id={id} value={role} onChange={(e) => setRole(e.target.value as ScheduleRole)}>
                <option value="editor">{ROLE_LABELS.editor}</option>
                <option value="viewer">{ROLE_LABELS.viewer}</option>
              </select>
            )}
          </Field>
          <Button type="submit" icon="plus" disabled={!email.trim()}>
            Invite
          </Button>
        </form>
      ) : team.open ? (
        <p className={styles.sectionHint}>Anyone who signs in can view this schedule.</p>
      ) : (
        <div className={styles.toolbar}>
          <Button variant="danger" onClick={() => void leave()}>
            Leave this schedule
          </Button>
        </div>
      )}
      {sent && <Notice>{sent}</Notice>}
      {isOwner && (
        <p className={styles.sectionHint}>
          Invited people can also open <strong>{appUrl()}</strong> and sign in with the invited email.{' '}
          <Button variant="ghost" size="sm" onClick={() => void copyLink()}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </p>
      )}
      {error && <Notice tone="warning">{error}</Notice>}
    </>
  );
}

/** For people on more than one schedule: which one is open, and the others. */
function ScheduleSwitcher({ account }: { account: Account }) {
  const repo = account.repository;
  const [schedules, setSchedules] = useState<ScheduleMembership[]>([]);

  useEffect(() => {
    let active = true;
    repo.listSchedules().then(
      (list) => active && setSchedules(list),
      () => {},
    );
    return () => {
      active = false;
    };
  }, [repo]);

  if (schedules.length < 2) return null;

  const open = (scheduleId: string) => {
    repo.switchTo(scheduleId);
    window.location.reload();
  };

  return (
    <>
      <h3 className={styles.section}>Your schedules</h3>
      <p className={styles.sectionHint}>
        You're on more than one. The one you open is remembered on this device.
      </p>
      <ul className={styles.list}>
        {schedules.map((s) => {
          const current = s.scheduleId === repo.scheduleId;
          const access = s.ownerId === account.userId ? 'Owner' : ROLE_LABELS[s.role];
          return (
            <li key={s.scheduleId} className={styles.item}>
              <span className={styles.main}>
                <span className={styles.name}>{s.title}</span>
                <span className={styles.meta}>
                  {access}
                  {current && ' · open now'}
                </span>
              </span>
              {!current && (
                <span className={styles.actions}>
                  <Button variant="ghost" size="sm" onClick={() => open(s.scheduleId)}>
                    Open
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * A schedule saved in this browser before sign-in, when the account already had one.
 * The editor can bring it in (replacing what's open, with undo) or set it aside.
 */
export function LocalLeftover() {
  const account = useAccount();
  const [visible, setVisible] = useState(() => account?.repository.hasLocalLeftover ?? false);
  if (!account || !visible) return null;

  const dismiss = () => {
    takeLocalSchedule();
    account.repository.clearLocalLeftover();
    setVisible(false);
  };

  const bringIn = () => {
    const data = takeLocalSchedule();
    account.repository.clearLocalLeftover();
    setVisible(false);
    if (data)
      scheduleStore
        .getState()
        .openSheet({ kind: 'import', data, fileName: 'The schedule saved in this browser' });
  };

  return (
    <>
      <Notice>
        This browser still has a schedule from before you signed in. You can bring it into this one or set it
        aside. Either way a copy stays in this browser.
      </Notice>
      <div className={styles.toolbar}>
        <Button onClick={bringIn}>Review and bring it in…</Button>
        <Button variant="ghost" onClick={dismiss}>
          Set it aside
        </Button>
      </div>
    </>
  );
}

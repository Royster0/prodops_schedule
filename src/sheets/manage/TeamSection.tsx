import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAccount, type Account } from '../../auth/account';
import { Button } from '../../components/Button';
import { Field, Notice } from '../../components/forms';
import type { ScheduleRole } from '../../data/supabaseRepository';
import styles from './manage.module.css';

interface Member {
  user_id: string;
  email: string;
  role: ScheduleRole;
}

interface Invite {
  email: string;
  role: ScheduleRole;
}

interface Team {
  members: Member[];
  invites: Invite[];
}

async function fetchTeam(client: SupabaseClient, scheduleId: string): Promise<Team | null> {
  const [m, i] = await Promise.all([
    client
      .from('schedule_members')
      .select('user_id, email, role')
      .eq('schedule_id', scheduleId)
      .order('joined_at'),
    client.from('schedule_invites').select('email, role').eq('schedule_id', scheduleId).order('created_at'),
  ]);
  if (m.error || i.error) return null;
  return { members: m.data as Member[], invites: i.data as Invite[] };
}

const ROLE_LABELS: Record<ScheduleRole, string> = { editor: 'Can edit', viewer: 'Can view' };

/** Signed-in account, the people who share this schedule, and invites. */
export function AccountSection() {
  const account = useAccount();
  if (!account) return null;
  return (
    <>
      <div className={styles.divider} />
      <h3 className={styles.section}>Team</h3>
      <p className={styles.sectionHint}>
        Everyone here signs in with their email and sees changes as they happen.
      </p>
      <TeamList account={account} />

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
  const client = account.repository.client;
  const scheduleId = account.repository.scheduleId;
  const isEditor = !account.repository.readOnly;
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ScheduleRole>('editor');
  const [error, setError] = useState<string | null>(null);

  const show = useCallback((team: Team | null) => {
    if (!team) {
      setError("Couldn't load the team. Check your connection.");
      return;
    }
    setMembers(team.members);
    setInvites(team.invites);
  }, []);

  const refresh = useCallback(() => {
    if (scheduleId) void fetchTeam(client, scheduleId).then(show);
  }, [client, scheduleId, show]);

  useEffect(() => {
    let active = true;
    if (scheduleId) {
      void fetchTeam(client, scheduleId).then((team) => {
        if (active) show(team);
      });
    }
    return () => {
      active = false;
    };
  }, [client, scheduleId, show]);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address || !scheduleId) return;
    if (members?.some((m) => m.email === address)) {
      setError(`${address} is already on the team.`);
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
  };

  const run = async (request: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: requestError } = await request;
    setError(requestError ? requestError.message : null);
    refresh();
  };

  if (!members) return error ? <Notice tone="warning">{error}</Notice> : null;

  return (
    <>
      <ul className={styles.list}>
        {members.map((m) => (
          <li key={m.user_id} className={styles.item}>
            <span className={styles.main}>
              <span className={styles.name}>{m.email || 'Teammate'}</span>
              <span className={styles.meta}>
                {ROLE_LABELS[m.role]}
                {m.user_id === account.userId && ' · you'}
              </span>
            </span>
            {isEditor && m.user_id !== account.userId && (
              <span className={styles.actions}>
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
        {invites.map((i) => (
          <li key={i.email} className={styles.item}>
            <span className={styles.main}>
              <span className={styles.name}>{i.email}</span>
              <span className={styles.meta}>
                Invited · {ROLE_LABELS[i.role].toLowerCase()} once they sign in
              </span>
            </span>
            {isEditor && (
              <span className={styles.actions}>
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

      {isEditor && (
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
      )}
      {error && <Notice tone="warning">{error}</Notice>}
    </>
  );
}

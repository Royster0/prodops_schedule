import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import type { ScheduleRole } from '../data/supabaseRepository';
import type { ID } from '../domain/types';
import { useAccount } from './account';

/** The sign-in linked to a person on the schedule. */
export interface PersonAccess {
  email: string;
  role: ScheduleRole;
  /** Invited but hasn't signed in yet. */
  invited: boolean;
  /** The schedule's owner, who can always edit. */
  owner: boolean;
}

export interface PeopleAccess {
  byPerson: Record<ID, PersonAccess>;
  /** Everyone signed in to this schedule, for suggesting emails. */
  memberEmails: string[];
}

interface MemberRow {
  user_id: string;
  email: string;
  role: ScheduleRole;
  employee_id: string | null;
}

interface InviteRow {
  email: string;
  role: ScheduleRole;
  employee_id: string | null;
}

export async function fetchPeopleAccess(
  client: SupabaseClient,
  scheduleId: string,
  ownerId: string | null,
): Promise<PeopleAccess | null> {
  const [m, i] = await Promise.all([
    client.from('schedule_members').select('user_id, email, role, employee_id').eq('schedule_id', scheduleId),
    client.from('schedule_invites').select('email, role, employee_id').eq('schedule_id', scheduleId),
  ]);
  if (m.error || i.error) return null;
  const byPerson: Record<ID, PersonAccess> = {};
  for (const row of i.data as InviteRow[]) {
    if (row.employee_id)
      byPerson[row.employee_id] = { email: row.email, role: row.role, invited: true, owner: false };
  }
  for (const row of m.data as MemberRow[]) {
    if (!row.employee_id) continue;
    const owner = row.user_id === ownerId;
    byPerson[row.employee_id] = {
      email: row.email,
      role: owner ? 'editor' : row.role,
      invited: false,
      owner,
    };
  }
  const memberEmails = (m.data as MemberRow[])
    .map((row) => row.email)
    .filter(Boolean)
    .sort();
  return { byPerson, memberEmails };
}

/**
 * Who signs in as each person on the open schedule. Null until loaded, and always null
 * when the app runs without accounts.
 */
export function usePeopleAccess(): { access: PeopleAccess | null; refresh(): void } {
  const account = useAccount();
  const repo = account?.repository;
  const [access, setAccess] = useState<PeopleAccess | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!repo?.scheduleId) return;
    let active = true;
    void fetchPeopleAccess(repo.client, repo.scheduleId, repo.ownerId).then((next) => {
      if (active && next) setAccess(next);
    });
    return () => {
      active = false;
    };
  }, [repo, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { access: repo ? access : null, refresh };
}

export const ACCESS_LABELS: Record<ScheduleRole, string> = { editor: 'Can edit', viewer: 'Can view' };

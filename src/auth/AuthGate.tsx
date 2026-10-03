import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../data/supabaseClient';
import { SupabaseRepository } from '../data/supabaseRepository';
import { repository } from '../store/useScheduleStore';
import { AccountContext, type Account } from './account';
import { SignIn } from './SignIn';

/**
 * Shows the sign-in screen until there is a session, then the app, which loads the
 * schedule from Supabase. Without Supabase configured the app runs as before.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!supabase) return <>{children}</>;
  return <SupabaseGate client={supabase}>{children}</SupabaseGate>;
}

function SupabaseGate({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  // undefined while the saved session (or the magic link in the URL) is checked.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) setSession((current) => (current === undefined ? data.session : current));
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession((current) => {
        // Another account, or signed out: start the app over rather than mix data.
        if (current && current.user.id !== next?.user.id) window.location.reload();
        return next;
      });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const userId = session?.user.id;
  const email = session?.user.email ?? '';
  const account = useMemo<Account | null>(() => {
    if (!userId) return null;
    const supabaseRepository = repositoryFor(client, userId);
    return {
      userId,
      email,
      repository: supabaseRepository,
      signOut: async () => {
        await client.auth.signOut();
        window.location.reload();
      },
    };
  }, [client, userId, email]);

  if (session === undefined) return null;
  if (!account) return <SignIn client={client} />;
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

let signedIn: { userId: string; repository: SupabaseRepository } | null = null;

/** One repository per account, so a repeated render can't make a second one. */
function repositoryFor(client: SupabaseClient, userId: string): SupabaseRepository {
  if (signedIn?.userId !== userId) {
    signedIn = { userId, repository: new SupabaseRepository(client) };
    repository.use(signedIn.repository);
  }
  return signedIn.repository;
}

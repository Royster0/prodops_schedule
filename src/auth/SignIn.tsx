import type { SupabaseClient } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Field, Notice } from '../components/forms';
import styles from './SignIn.module.css';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

/** Email in, magic link out. The link brings the person back here signed in. */
export function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>(() => {
    const linkError = readLinkError();
    return linkError ? { kind: 'error', message: linkError } : { kind: 'idle' };
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setState({ kind: 'sending' });
    const { error } = await client.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setState(
      error ? { kind: 'error', message: friendlyError(error.message) } : { kind: 'sent', email: address },
    );
  };

  return (
    <main className={styles.wrap}>
      <section className={styles.card} aria-labelledby="sign-in-title">
        <h1 id="sign-in-title" className={styles.title}>
          Team schedule
        </h1>
        {state.kind === 'sent' ? (
          <>
            <p className={styles.text}>
              We sent a sign-in link to <strong>{state.email}</strong>. Open it on this device to continue.
            </p>
            <Button variant="ghost" onClick={() => setState({ kind: 'idle' })}>
              Use a different email
            </Button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className={styles.text}>Sign in with your email. We'll send you a link, no password needed.</p>
            <Field label="Email">
              {(id) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            {state.kind === 'error' && <Notice tone="warning">{state.message}</Notice>}
            <div className={styles.actions}>
              <Button type="submit" variant="primary" disabled={state.kind === 'sending'}>
                {state.kind === 'sending' ? 'Sending…' : 'Send sign-in link'}
              </Button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

/** An expired or used link comes back with the reason in the URL. */
function readLinkError(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  const description = params.get('error_description');
  if (!description) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return /expired|invalid/i.test(description)
    ? 'That sign-in link has expired or was already used. Send a new one.'
    : description.replace(/\+/g, ' ');
}

function friendlyError(message: string): string {
  if (/rate limit|security purposes/i.test(message)) {
    return 'Too many links were requested. Wait a minute and try again.';
  }
  return message;
}

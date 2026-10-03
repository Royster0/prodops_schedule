import type { SupabaseClient } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Field, Notice } from '../components/forms';
import styles from './SignIn.module.css';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'redirecting' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

/**
 * Two ways in: Google, or a magic link by email. Either brings the person back here
 * signed in, and the same email gets the same account and invites.
 */
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

  const google = async () => {
    setState({ kind: 'redirecting' });
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    // On success the browser is already on its way to Google.
    if (error) setState({ kind: 'error', message: error.message });
  };

  const busy = state.kind === 'sending' || state.kind === 'redirecting';

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
            <p className={styles.text}>Sign in to see your team's schedule.</p>
            {state.kind === 'error' && <Notice tone="warning">{state.message}</Notice>}
            <Button className={styles.google} onClick={() => void google()} disabled={busy}>
              <GoogleMark />
              {state.kind === 'redirecting' ? 'Opening Google…' : 'Continue with Google'}
            </Button>
            <p className={styles.or}>
              <span>or get a sign-in link by email</span>
            </p>
            <Field label="Email">
              {(id) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <div className={styles.actions}>
              <Button type="submit" variant="primary" disabled={busy}>
                {state.kind === 'sending' ? 'Sending…' : 'Send sign-in link'}
              </Button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

/** A failed sign-in (expired link, Google cancelled) comes back with the reason in the URL. */
function readLinkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const error = hash.get('error') ?? query.get('error');
  const description = hash.get('error_description') ?? query.get('error_description');
  if (!error && !description) return null;
  window.history.replaceState(null, '', window.location.pathname);
  if (error === 'access_denied' && !/expired|invalid/i.test(description ?? '')) {
    return 'Google sign-in was cancelled. Try again, or use a link by email.';
  }
  if (/expired|invalid/i.test(description ?? '')) {
    return 'That sign-in link has expired or was already used. Send a new one.';
  }
  return (description ?? 'Sign-in failed.').replace(/\+/g, ' ');
}

/** Google's "G", in its brand colors as their sign-in guidelines ask. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className={styles.googleMark}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function friendlyError(message: string): string {
  if (/rate limit|security purposes/i.test(message)) {
    return 'Too many links were requested. Wait a minute and try again.';
  }
  return message;
}

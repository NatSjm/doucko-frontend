import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/design-system';
import { useT } from '@/i18n';
import { signIn } from './session';

/**
 * The admin sign-in form (store spec admin-access): one password field, no user name. Enter submits.
 * A wrong password clears the field and keeps focus there; a server failure keeps what was typed.
 */
export function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useT();
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<'invalid' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (await signIn(password)) {
        onSignedIn();
        return;
      }
      setError('invalid');
      setPassword('');
    } catch {
      setError('failed');
    }
    setBusy(false);
    field.current?.focus();
  }

  return (
    <main className="app-shell">
      <form className="admin-stack" onSubmit={submit} noValidate>
        <h1 className="dk-t-title">{t('admin.signIn.title')}</h1>
        <label className="admin-label" htmlFor={fieldId}>
          {t('admin.signIn.password')}
        </label>
        <input
          id={fieldId}
          ref={field}
          className="dk-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p role="alert">{t(error === 'invalid' ? 'admin.signIn.invalid' : 'admin.signIn.failed')}</p>}
        <Button type="submit" variant="primary" disabled={busy}>
          {t('admin.signIn.submit')}
        </Button>
      </form>
    </main>
  );
}

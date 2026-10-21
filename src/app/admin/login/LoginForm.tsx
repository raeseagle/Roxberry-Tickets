'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signIn, type LoginState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function LoginForm() {
  const [state, action] = useFormState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="mt-6 space-y-3">
      <div>
        <label htmlFor="username" className="label">
          Username
        </label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required className="field py-2.5" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field py-2.5" />
      </div>
      <Submit />
      {state.error && (
        <p className="text-sm text-amber-200" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

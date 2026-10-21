'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changePassword, type PwState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
      {pending ? 'Saving…' : 'Save new password'}
    </button>
  );
}

export default function PasswordForm() {
  const [state, action] = useFormState<PwState, FormData>(changePassword, {});
  return (
    <form action={action} className="mt-6 space-y-3">
      <div>
        <label htmlFor="current" className="label">
          Current password
        </label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="field py-2.5" />
      </div>
      <div>
        <label htmlFor="next" className="label">
          New password (10+ characters)
        </label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className="field py-2.5" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          New password again
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="field py-2.5" />
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

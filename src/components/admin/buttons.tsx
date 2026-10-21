'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, className = 'btn-primary', pendingText = 'Saving…' }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

/** A submit button that asks for confirmation first. */
export function ConfirmButton({ children, message, className = 'btn-danger' }: { children: React.ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? 'Working…' : children}
    </button>
  );
}

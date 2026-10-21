import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import PasswordForm from './PasswordForm';

export const dynamic = 'force-dynamic';

export default async function PasswordPage() {
  const admin = await requireAdmin({ allowPasswordChange: true });
  return (
    <main className="arena flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-5xl font-black uppercase leading-none text-white">
          {admin.mustChangePassword ? 'Choose your password' : 'Change password'}
        </h1>
        <p className="mt-3 text-silver-300">
          {admin.mustChangePassword
            ? `Welcome, ${admin.username}. Replace the temporary password you were given with one only you know.`
            : `Signed in as ${admin.username}.`}
        </p>
        <PasswordForm />
        {!admin.mustChangePassword && (
          <Link href="/admin" className="mt-4 inline-block text-sm text-silver-400 hover:text-white">
            Back to dashboard
          </Link>
        )}
      </div>
    </main>
  );
}

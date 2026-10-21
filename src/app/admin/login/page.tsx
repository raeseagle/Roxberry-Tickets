import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main className="arena flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/roxberry-logo.png" alt="Roxberry Juice Co." width={80} height={80} className="mb-6 h-20 w-20 rounded-2xl" />
        <h1 className="font-display text-5xl font-black uppercase leading-none text-white">Ticket desk</h1>
        <p className="mt-3 text-silver-300">Administrators only. Forgot your password? Ask another administrator to reset it.</p>
        <LoginForm />
      </div>
    </main>
  );
}

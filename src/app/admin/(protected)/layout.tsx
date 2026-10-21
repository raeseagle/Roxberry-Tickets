import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';
import AutoRefresh from '@/components/admin/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-navy-950">
      <header className="border-b border-navy-800 bg-navy-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-display text-2xl font-black uppercase text-white">
            Ticket desk
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3 text-xs text-silver-400">
            <Link href="/" target="_blank" className="hover:text-white">
              View public site
            </Link>
            <Link href="/admin/password" className="hidden hover:text-white sm:inline" title="Change password">
              {admin.username}
            </Link>
            <form action="/admin/logout" method="post">
              <button className="btn-ghost px-2.5 py-1 text-xs">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <AutoRefresh />
        {children}
      </main>
    </div>
  );
}

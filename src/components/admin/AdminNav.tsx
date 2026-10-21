'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/allocations', label: 'Allocations' },
  { href: '/admin/games', label: 'Games' },
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/emails', label: 'Emails' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto text-sm">
      {ITEMS.map((i) => {
        const on = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${on ? 'bg-navy-700 text-white' : 'text-silver-300 hover:bg-navy-800 hover:text-white'}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

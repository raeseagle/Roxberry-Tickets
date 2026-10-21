import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Roxberry Juice Co. — Utah Jazz & Utah Mammoth Tickets',
  description: 'Complimentary Utah Jazz and Utah Mammoth tickets from Roxberry Juice Co. Thank you for all you do.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#831781', width: 'device-width', initialScale: 1 };

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const c = s.teamColors;
  const safe = (v: string, d: string) => (HEX.test(v) ? v : d);
  const vars = `:root{--jazz:${safe(c.jazz.primary, '#F9A01B')};--jazz-accent:${safe(c.jazz.accent, '#FCD58C')};--mammoth:${safe(c.mammoth.primary, '#8FD0F5')};--mammoth-accent:${safe(c.mammoth.accent, '#CFEBFB')};}`;
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: vars }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

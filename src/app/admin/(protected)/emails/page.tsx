import { db } from '@/lib/supabase/admin';
import { Flash, PageHeader } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/buttons';
import EmailLogTable from '@/components/admin/EmailLogTable';
import { retryAllFailed } from './actions';
import { emailConfigured } from '@/lib/email';

export default async function EmailsPage({ searchParams }: { searchParams: { status?: string; msg?: string; err?: string } }) {
  const status = searchParams.status ?? 'all';
  let query = db().from('email_logs').select('*').order('created_at', { ascending: false }).limit(300);
  if (status !== 'all') query = query.eq('status', status);
  const { data } = await query;
  const { count: failed } = await db().from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed');
  const configured = emailConfigured();

  return (
    <>
      <PageHeader title="Emails">
        {!!failed && (
          <form action={retryAllFailed}>
            <SubmitButton className="btn-primary" pendingText="Retrying…">
              Retry all {failed} failed
            </SubmitButton>
          </form>
        )}
      </PageHeader>
      <Flash searchParams={searchParams} />
      <p className="mb-5 rounded-lg border border-navy-700 bg-navy-900 px-4 py-3 text-sm text-silver-300">
        {configured
          ? 'Alerts are sent by email (SMTP) to the notification recipients in Settings.'
          : 'Alerts are sent through Netlify Forms. Who receives them is set in Netlify under Site configuration → Notifications → Form submission notifications.'}
      </p>
      <form method="get" className="mb-4 flex gap-2">
        {['all', 'failed', 'sent', 'pending'].map((s) => (
          <button key={s} name="status" value={s} className={s === status ? 'btn-primary' : 'btn-ghost'}>
            {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </form>
      <div className="panel p-2">
        <EmailLogTable logs={(data ?? []) as any[]} returnTo={`/admin/emails?status=${status}`} />
      </div>
      <p className="mt-3 text-xs text-silver-500">Retrying an email never creates or changes an allocation — it only re-sends the message.</p>
    </>
  );
}

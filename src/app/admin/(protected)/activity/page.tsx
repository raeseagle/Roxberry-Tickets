import { db } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/ui';
import AuditList from '@/components/admin/AuditList';

export default async function ActivityPage() {
  const { data } = await db().from('audit_log').select('*').order('occurred_at', { ascending: false }).limit(300);
  return (
    <>
      <PageHeader title="Activity" />
      <p className="mb-4 text-sm text-silver-400">Every allocation, inventory change, cancellation, reassignment, and admin edit — newest first.</p>
      <div className="panel">
        <AuditList entries={(data ?? []) as any[]} />
      </div>
    </>
  );
}

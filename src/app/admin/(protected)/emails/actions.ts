'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { retryEmail } from '@/lib/email';
import { audit } from '@/lib/audit';
import { db } from '@/lib/supabase/admin';
import { safeReturn } from '@/lib/clients';
import { done, oops } from '@/lib/flash';

export async function retryEmailAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const back = safeReturn(formData.get('return_to'), '/admin/emails');
  const claimed = await retryEmail(id);
  if (!claimed) oops(back, 'That email is not in a failed state (it may already be sending or sent).');
  const { data } = await db().from('email_logs').select('status,error,allocation_id').eq('id', id).single();
  await audit(admin.email, 'email.retried', 'allocation', (data as any)?.allocation_id ?? null, { result: (data as any)?.status });
  revalidatePath('/admin', 'layout');
  if ((data as any)?.status === 'sent') done(back, 'Email sent.');
  oops(back, `The email failed again: ${(data as any)?.error ?? 'unknown error'}`);
}

export async function retryAllFailed() {
  const admin = await requireAdmin();
  const { data } = await db().from('email_logs').select('id').eq('status', 'failed').limit(50);
  let sent = 0;
  for (const row of (data ?? []) as any[]) {
    await retryEmail(row.id);
    const { data: after } = await db().from('email_logs').select('status').eq('id', row.id).single();
    if ((after as any)?.status === 'sent') sent++;
  }
  await audit(admin.email, 'email.retried', 'email', null, { attempted: data?.length ?? 0, sent });
  revalidatePath('/admin', 'layout');
  done('/admin/emails', `Retried ${data?.length ?? 0} emails; ${sent} sent.`);
}

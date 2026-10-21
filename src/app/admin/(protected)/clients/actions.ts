'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { ensureClient, safeReturn } from '@/lib/clients';
import { readCsvFile, truthy } from '@/lib/csv';
import { EMAIL_RE, normalizeEmail } from '@/lib/format';
import { done, oops } from '@/lib/flash';

function dupMessage(msg: string) {
  return msg.includes('duplicate') || msg.includes('unique') ? 'Another client already uses that email address.' : msg;
}

export async function createClientAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get('full_name') ?? '');
  const email = String(formData.get('email') ?? '');
  if (email.trim()) {
    const { data: existing } = await db().from('clients').select('id').eq('email', normalizeEmail(email)).maybeSingle();
    if (existing) oops('/admin/clients', 'A client with that email already exists.');
  }
  let id = '';
  try {
    id = await ensureClient(name, email || null, admin.email);
  } catch (e) {
    oops('/admin/clients', (e as Error).message);
  }
  const notes = String(formData.get('notes') ?? '').trim();
  if (notes) await db().from('clients').update({ notes }).eq('id', id);
  revalidatePath('/admin/clients');
  done(`/admin/clients/${id}`, 'Client added.');
}

/** Name + email correction (used from allocation pages too). */
export async function updateClientContact(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const back = safeReturn(formData.get('return_to'), `/admin/clients/${id}`);
  const full_name = String(formData.get('full_name') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? '')) || null;
  if (!full_name) oops(back, 'Enter a name.');
  if (email && !EMAIL_RE.test(email)) oops(back, 'That email address isn’t valid (or leave it blank).');
  const { data: before } = await db().from('clients').select('full_name,email').eq('id', id).single();
  const { error } = await db().from('clients').update({ full_name, email }).eq('id', id);
  if (error) oops(back, dupMessage(error.message));
  await audit(admin.email, 'client.updated', 'client', id, {
    name_from: (before as any)?.full_name,
    name_to: full_name,
    email_from: (before as any)?.email,
    email_to: email,
  });
  revalidatePath('/admin', 'layout');
  done(back, 'Contact info updated.');
}

export async function updateClientAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const back = `/admin/clients/${id}`;
  const full_name = String(formData.get('full_name') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? '')) || null;
  if (!full_name) oops(back, 'Enter a name.');
  if (email && !EMAIL_RE.test(email)) oops(back, 'That email address isn’t valid (or leave it blank).');
  const patch = {
    full_name,
    email,
    notes: String(formData.get('notes') ?? '').slice(0, 5000),
    is_active: formData.get('is_active') === 'on',
    is_archived: formData.get('is_archived') === 'on',
  };
  const { error } = await db().from('clients').update(patch).eq('id', id);
  if (error) oops(back, dupMessage(error.message));
  await audit(admin.email, 'client.updated', 'client', id, { full_name, email, active: patch.is_active, archived: patch.is_archived });
  revalidatePath('/admin', 'layout');
  done(back, 'Client saved.');
}

export async function importClients(formData: FormData) {
  const admin = await requireAdmin();
  let rows: Record<string, string>[] = [];
  try {
    rows = await readCsvFile(formData.get('file') as File | null);
  } catch (e) {
    oops('/admin/clients', (e as Error).message);
  }
  let added = 0;
  let skipped = 0;
  const problems: string[] = [];
  for (const [i, r] of rows.entries()) {
    const name = (r.full_name ?? r.name ?? '').trim();
    const email = normalizeEmail(r.email ?? '');
    if (!name || !EMAIL_RE.test(email)) {
      problems.push(`row ${i + 2}`);
      continue;
    }
    const { error } = await db()
      .from('clients')
      .insert({ full_name: name, email, notes: r.notes?.trim() || null, is_active: truthy(r.active, true) });
    if (error) skipped++;
    else added++;
  }
  await audit(admin.email, 'client.imported', 'client', null, { added, skipped_existing: skipped, invalid_rows: problems.length });
  revalidatePath('/admin/clients');
  const extra = problems.length ? ` Skipped invalid ${problems.slice(0, 5).join(', ')}${problems.length > 5 ? '…' : ''}.` : '';
  done('/admin/clients', `Imported ${added} new ${added === 1 ? 'client' : 'clients'}; ${skipped} already existed.${extra}`);
}

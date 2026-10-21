'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { ensureClient } from '@/lib/clients';
import { done, oops } from '@/lib/flash';

function refreshAll(id?: string) {
  revalidatePath('/', 'layout');
  if (id) revalidatePath(`/admin/allocations/${id}`);
}

export async function saveAllocationNotes(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const notes = String(formData.get('notes') ?? '').slice(0, 5000);
  const { error } = await db().from('allocations').update({ notes }).eq('id', id);
  if (error) oops(`/admin/allocations/${id}`, error.message);
  await audit(admin.email, 'allocation.notes_updated', 'allocation', id);
  refreshAll(id);
  done(`/admin/allocations/${id}`, 'Notes saved.');
}

export async function changeQuantity(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const qty = Number(formData.get('quantity'));
  const { data, error } = await db().rpc('admin_update_allocation_quantity', { p_allocation_id: id, p_quantity: qty, p_actor: admin.email });
  if (error) oops(`/admin/allocations/${id}`, error.message);
  const r = data as any;
  if (!r.ok) {
    const msg =
      r.code === 'insufficient'
        ? `Not enough seats. This allocation can hold at most ${r.max} tickets with the game's current inventory.`
        : r.code === 'not_active'
          ? 'Cancelled allocations cannot be changed.'
          : 'That quantity is not valid.';
    oops(`/admin/allocations/${id}`, msg);
  }
  if (r.unchanged) done(`/admin/allocations/${id}`, 'No change — that is already the ticket count.');
  refreshAll(id);
  done(`/admin/allocations/${id}`, `Ticket count changed from ${r.old_quantity} to ${r.new_quantity}.`);
}

export async function cancelAllocation(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const reason = String(formData.get('reason') ?? '').slice(0, 500) || null;
  const { data, error } = await db().rpc('admin_cancel_allocation', { p_allocation_id: id, p_actor: admin.email, p_reason: reason });
  if (error) oops(`/admin/allocations/${id}`, error.message);
  const r = data as any;
  if (!r.ok) oops(`/admin/allocations/${id}`, r.code === 'already_cancelled' ? 'This allocation was already cancelled.' : 'Allocation not found.');
  refreshAll(id);
  done(
    `/admin/allocations/${id}`,
    `Cancelled. ${r.seats_restored} ${r.seats_restored === 1 ? 'seat was' : 'seats were'} returned to the game's inventory${
      r.game_closed ? ', but the game stays closed until you reopen it' : ''
    }.`,
  );
}

export async function reassignAllocation(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  let clientId = String(formData.get('client_id') ?? '');
  const newName = String(formData.get('new_name') ?? '').trim();
  const newEmail = String(formData.get('new_email') ?? '').trim();
  try {
    if (newName || newEmail) clientId = await ensureClient(newName, newEmail || null, admin.email);
  } catch (e) {
    oops(`/admin/allocations/${id}`, (e as Error).message);
  }
  if (!clientId) oops(`/admin/allocations/${id}`, 'Choose an existing client or enter a new one.');

  const { data, error } = await db().rpc('admin_reassign_allocation', { p_allocation_id: id, p_client_id: clientId, p_actor: admin.email });
  if (error) oops(`/admin/allocations/${id}`, error.message);
  const r = data as any;
  if (!r.ok) {
    const msg = { same_client: 'Those tickets already belong to that client.', not_active: 'Cancelled allocations cannot be reassigned.' }[r.code as string];
    oops(`/admin/allocations/${id}`, msg ?? 'Could not reassign these tickets.');
  }
  refreshAll(id);
  done(`/admin/allocations/${id}`, `Tickets reassigned.`);
}

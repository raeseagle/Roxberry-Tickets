import 'server-only';
import { db } from './supabase/admin';

export async function audit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await db().from('audit_log').insert({
    actor,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}

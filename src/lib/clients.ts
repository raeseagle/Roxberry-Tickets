import 'server-only';
import { db } from './supabase/admin';
import { audit } from './audit';
import { EMAIL_RE, normalizeEmail } from './format';

/** Finds a client by normalized email or creates one. Returns the client id. */
/**
 * Finds or creates a client. Email is optional for people added by an admin:
 * with an email, clients are matched by email; without one, by exact name
 * among clients who also have no email.
 */
export async function ensureClient(fullName: string, rawEmail: string | null | undefined, actor: string) {
  const email = rawEmail ? normalizeEmail(rawEmail) : '';
  const name = fullName.trim().slice(0, 200);
  if (!name) throw new Error('Enter a name.');
  if (email && !EMAIL_RE.test(email)) throw new Error('That email address isn’t valid (or leave it blank).');
  if (email) {
    const { data: existing } = await db().from('clients').select('id').eq('email', email).maybeSingle();
    if (existing) return (existing as any).id as string;
  } else {
    const pattern = name.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: sameName } = await db().from('clients').select('id').is('email', null).ilike('full_name', pattern).limit(1);
    if (sameName?.length) return (sameName[0] as any).id as string;
  }
  const { data, error } = await db().from('clients').insert({ full_name: name, email: email || null }).select('id').single();
  if (error) throw new Error(error.message);
  await audit(actor, 'client.created', 'client', (data as any).id, { full_name: name, email });
  return (data as any).id as string;
}

export function safeReturn(v: FormDataEntryValue | null, fallback: string) {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/admin') && !s.startsWith('//') ? s : fallback;
}

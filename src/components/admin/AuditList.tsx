import { fmtStamp } from '@/lib/format';

const LABELS: Record<string, string> = {
  'allocation.created': 'Tickets allocated',
  'allocation.cancelled': 'Allocation cancelled',
  'allocation.reassigned': 'Tickets reassigned',
  'allocation.quantity_changed': 'Ticket count changed',
  'allocation.notes_updated': 'Allocation notes edited',
  'game.created': 'Game added',
  'game.updated': 'Game edited',
  'game.inventory_changed': 'Inventory changed',
  'game.closed': 'Game closed',
  'game.reopened': 'Game reopened',
  'game.published': 'Game published',
  'game.unpublished': 'Game unpublished',
  'game.deleted': 'Game deleted',
  'game.reminder_sent': 'Reminder sent',
  'game.imported': 'Games imported',
  'client.created': 'Client added',
  'client.updated': 'Client edited',
  'client.imported': 'Clients imported',
  'admin.added': 'Administrator added',
  'admin.updated': 'Administrator changed',
  'admin.password_changed': 'Password changed',
  'admin.password_reset': 'Password reset by an administrator',
  'settings.updated': 'Settings changed',
  'email.retried': 'Email retried',
};

function summarize(d: Record<string, unknown>) {
  const skip = new Set(['game_id', 'client_id', 'from_client_id', 'to_client_id']);
  return Object.entries(d ?? {})
    .filter(([k, v]) => !skip.has(k) && v !== null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' · ');
}

export default function AuditList({ entries }: { entries: { id: number; occurred_at: string; actor: string; action: string; details: Record<string, unknown> }[] }) {
  if (!entries.length) return <p className="mt-2 text-sm text-silver-400">Nothing recorded yet.</p>;
  return (
    <ol className="mt-3 space-y-3 border-l border-navy-700 pl-4">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-silver-400" />
          <p className="text-sm text-white">{LABELS[e.action] ?? e.action}</p>
          <p className="text-xs text-silver-400">
            {fmtStamp(e.occurred_at)} MT · {e.actor}
          </p>
          {summarize(e.details) && <p className="text-xs text-silver-500">{summarize(e.details)}</p>}
        </li>
      ))}
    </ol>
  );
}

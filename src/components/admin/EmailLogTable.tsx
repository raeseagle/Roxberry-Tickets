import Link from 'next/link';
import { fmtStamp } from '@/lib/format';
import { NOTIFICATION_LABELS, type NotificationType } from '@/lib/email-labels';
import { StatusPill } from './ui';
import { SubmitButton } from './buttons';
import { retryEmailAction } from '@/app/admin/(protected)/emails/actions';

type Log = {
  id: string;
  allocation_id: string | null;
  recipient: string;
  notification_type: string;
  status: string;
  subject: string | null;
  attempts: number;
  attempted_at: string | null;
  provider_message_id: string | null;
  error: string | null;
};

export default function EmailLogTable({ logs, returnTo, compact = false }: { logs: Log[]; returnTo: string; compact?: boolean }) {
  if (!logs.length) return <p className="mt-2 text-sm text-silver-400">No emails yet.</p>;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Recipient</th>
            <th>Status</th>
            <th>Last attempt</th>
            {!compact && <th>Allocation</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="text-silver-200">
                {NOTIFICATION_LABELS[l.notification_type as NotificationType] ?? l.notification_type}
                {l.subject && <div className="max-w-xs truncate text-xs text-silver-500">{l.subject}</div>}
              </td>
              <td className="text-silver-300">{l.recipient}</td>
              <td>
                <StatusPill status={l.status} />
                {l.error && <div className="mt-1 max-w-xs text-xs text-red-200">{l.error}</div>}
              </td>
              <td className="whitespace-nowrap text-xs text-silver-400">
                {fmtStamp(l.attempted_at)}
                <div>
                  {l.attempts} {l.attempts === 1 ? 'attempt' : 'attempts'}
                </div>
              </td>
              {!compact && (
                <td>
                  {l.allocation_id ? (
                    <Link className="text-xs text-silver-300 hover:underline" href={`/admin/allocations/${l.allocation_id}`}>
                      Open
                    </Link>
                  ) : (
                    <span className="text-xs text-silver-500">—</span>
                  )}
                </td>
              )}
              <td className="text-right">
                {l.status === 'failed' && (
                  <form action={retryEmailAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <SubmitButton className="btn-ghost px-2.5 py-1 text-xs" pendingText="Sending…">
                      Retry
                    </SubmitButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

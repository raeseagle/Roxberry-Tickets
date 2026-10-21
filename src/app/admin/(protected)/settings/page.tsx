import Link from 'next/link';
import { db } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/settings';
import { requireAdmin } from '@/lib/auth';
import { Flash, PageHeader } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/buttons';
import { addAdmin, resetAdminPassword, saveCopy, saveDisplay, saveEmailTemplates, saveRecipients, setAdminActive } from './actions';

function Field({ name, label, value, rows, hint }: { name: string; label: string; value: string; rows?: number; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {rows ? <textarea id={name} name={name} rows={rows} defaultValue={value} className="field" /> : <input id={name} name={name} defaultValue={value} className="field" />}
      {hint && <p className="mt-1 text-xs text-silver-500">{hint}</p>}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: { msg?: string; err?: string } }) {
  const me = await requireAdmin();
  const s = await getSettings();
  const { data: admins } = await db().from('admins').select('id,username,email,role,is_active,must_change_password,password_hash').order('created_at');
  const { count: failed } = await db().from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed');

  return (
    <>
      <PageHeader title="Settings" />
      <Flash searchParams={searchParams} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="font-semibold text-white">Public website copy</h2>
          <form action={saveCopy} className="mt-4 space-y-4">
            <Field name="seasonLabel" label="Season label (top of page)" value={s.seasonLabel} />
            <Field name="headline" label="Headline" value={s.headline} hint="Each sentence goes on its own line." />
            <Field name="intro" label="Introduction" value={s.intro} rows={5} hint="Wrap words in *asterisks* for italics. Leave a blank line between paragraphs." />
            <Field name="disclaimer" label="Disclaimer" value={s.disclaimer} rows={3} />
            <Field name="privacyNotice" label="Privacy notice" value={s.privacyNotice} rows={3} />
            <SubmitButton>Save copy</SubmitButton>
          </form>
        </section>

        <div className="space-y-6">
          <section className="panel">
            <h2 className="font-semibold text-white">Administrators</h2>
            <ul className="mt-3 divide-y divide-navy-700">
              {((admins ?? []) as any[]).map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={a.is_active ? 'font-semibold text-white' : 'text-silver-500 line-through'}>{a.username}</p>
                      <p className="text-xs text-silver-500">
                        {a.role === 'owner' ? 'Owner' : 'Admin'}
                        {a.email ? ` · ${a.email}` : ''}
                        {a.id === me.id ? ' · you' : ''}
                        {!a.password_hash ? ' · no password set' : a.must_change_password ? ' · must choose a new password' : ''}
                      </p>
                    </div>
                    {a.id !== me.id && (
                      <form action={setAdminActive}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="active" value={String(!a.is_active)} />
                        <SubmitButton className="btn-ghost px-2.5 py-1 text-xs" pendingText="…">
                          {a.is_active ? 'Deactivate' : 'Reactivate'}
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                  {a.id !== me.id && a.is_active && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-silver-400 hover:text-white">Reset password</summary>
                      <form action={resetAdminPassword} className="mt-2 flex gap-2">
                        <input type="hidden" name="id" value={a.id} />
                        <input name="password" type="text" minLength={10} required placeholder="New temporary password" className="field flex-1" autoComplete="off" />
                        <SubmitButton className="btn-ghost text-xs">Reset</SubmitButton>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="mt-5 text-sm font-semibold text-white">Add an administrator</h3>
            <form action={addAdmin} className="mt-2 grid gap-2 sm:grid-cols-2">
              <input name="username" placeholder="Username, e.g. jsmith" className="field" required autoCapitalize="none" autoComplete="off" />
              <input name="email" type="email" placeholder="Email (optional)" className="field" />
              <input name="password" type="text" minLength={10} placeholder="Temporary password (10+ characters)" className="field" required autoComplete="off" />
              <select name="role" className="field">
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
              <div className="sm:col-span-2">
                <SubmitButton className="btn-ghost">Add administrator</SubmitButton>
              </div>
            </form>
            <p className="mt-2 text-xs text-silver-500">They sign in at /admin/login and must replace the temporary password the first time.</p>
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">Notification recipients</h2>
            <p className="mt-1 text-xs text-silver-400">Only used if the site is switched to sending through an email account (SMTP). While alerts go through Netlify Forms, recipients are managed in Netlify under Notifications → Form submission notifications.</p>
            <form action={saveRecipients} className="mt-3 space-y-3">
              <textarea name="recipients" rows={3} defaultValue={s.notificationRecipients.join('\n')} className="field" />
              <SubmitButton>Save recipients</SubmitButton>
            </form>
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">Defaults, colors and display</h2>
            <form action={saveDisplay} className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="defaultInventory">
                  Default tickets per new game
                </label>
                <input id="defaultInventory" name="defaultInventory" type="number" min={0} max={50} defaultValue={s.defaultInventory} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="defaultTab">
                  Tab shown first
                </label>
                <select id="defaultTab" name="defaultTab" defaultValue={s.display.defaultTab} className="field">
                  <option value="jazz">Utah Jazz</option>
                  <option value="mammoth">Utah Mammoth</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="publicWindowDays">
                  Public page shows games this many days ahead
                </label>
                <input id="publicWindowDays" name="publicWindowDays" type="number" min={1} max={365} defaultValue={s.publicWindowDays} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="reminderDaysBefore">
                  Send game reminders this many days before
                </label>
                <input id="reminderDaysBefore" name="reminderDaysBefore" type="number" min={1} max={30} defaultValue={s.reminderDaysBefore} className="field" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="reminderRecipient">
                  Game reminder recipient (when sending by email account)
                </label>
                <input id="reminderRecipient" name="reminderRecipient" type="email" defaultValue={s.reminderRecipient} className="field" />
                <p className="mt-1 text-xs text-silver-500">While alerts go through Netlify Forms, set who receives reminders in Netlify (form: game-reminder).</p>
              </div>
              {(
                [
                  ['jazzPrimary', 'Jazz main color', s.teamColors.jazz.primary],
                  ['jazzAccent', 'Jazz accent', s.teamColors.jazz.accent],
                  ['mammothPrimary', 'Mammoth main color', s.teamColors.mammoth.primary],
                  ['mammothAccent', 'Mammoth accent', s.teamColors.mammoth.accent],
                ] as const
              ).map(([n, l, v]) => (
                <div key={n}>
                  <label className="label" htmlFor={n}>
                    {l}
                  </label>
                  <input id={n} name={n} type="color" defaultValue={v} className="h-10 w-full cursor-pointer rounded border border-navy-700 bg-navy-950" />
                </div>
              ))}
              <label className="col-span-2 flex items-center gap-2 text-sm text-silver-300">
                <input type="checkbox" name="showVenue" defaultChecked={s.display.showVenue} /> Show venue on game cards
              </label>
              <label className="col-span-2 flex items-center gap-2 text-sm text-silver-300">
                <input type="checkbox" name="showTotalInventory" defaultChecked={s.display.showTotalInventory} /> Show total seats on game cards
              </label>
              <div className="col-span-2">
                <SubmitButton>Save display settings</SubmitButton>
              </div>
            </form>
          </section>
        </div>

        <section className="panel">
          <h2 className="font-semibold text-white">Alert email</h2>
          <p className="mt-1 text-xs text-silver-400">
            Placeholders: <code>{'{team}'}</code> <code>{'{opponent}'}</code> <code>{'{date}'}</code> <code>{'{time}'}</code> <code>{'{name}'}</code>{' '}
            <code>{'{quantity}'}</code>. Sent to the notification recipients each time tickets are claimed. The site never emails clients.
          </p>
          <form action={saveEmailTemplates} className="mt-4 space-y-4">
            <Field name="internalSubject" label="Subject line" value={s.email.internalSubject} />
            <SubmitButton>Save subject line</SubmitButton>
          </form>
        </section>

        <section className="panel h-fit">
          <h2 className="font-semibold text-white">Exports and logs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a className="text-silver-100 underline" href="/api/admin/export/allocations?status=all&when=all">
                All allocations (CSV)
              </a>
            </li>
            <li>
              <a className="text-silver-100 underline" href="/api/admin/export/clients">
                Client directory (CSV)
              </a>
            </li>
            <li>
              <a className="text-silver-100 underline" href="/api/admin/export/games">
                Game schedule (CSV)
              </a>
            </li>
            <li>
              <Link className="text-silver-100 underline" href="/admin/emails?status=failed">
                Failed notifications {failed ? `(${failed})` : ''}
              </Link>
            </li>
            <li>
              <Link className="text-silver-100 underline" href="/admin/activity">
                Activity history
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}

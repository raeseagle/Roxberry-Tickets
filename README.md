# Roxberry Juice Co. Season Tickets — Setup Guide

> **Mock site.** The schedule holds 8 sample games until Roxberry's real tickets are known. To change them, delete or edit games under **Games** in the dashboard, add new ones with **Add game**, or import a list with **Import from CSV**. `data/full-schedule-2026-27.csv` has every home game for both teams if you want to copy rows from it.
>
> This is a **separate copy** of the season-ticket site, branded for Roxberry Juice Co. It needs its **own** GitHub repository, its **own** Supabase project and its **own** Netlify site. Don't reuse the ones from the Chad Pehrson site, or the two sites would share (and overwrite) each other's data.

This is the ticket giveaway website for Utah Jazz and Utah Mammoth home games. Clients pick a game, enter their name and email, and get up to four seats on a first-come, first-served basis. Each claim triggers an alert email to the Roxberry team through Netlify's built-in form notifications; the site never emails clients (Rae sends confirmations personally when needed). The Roxberry team manages everything from a private dashboard at `/admin`.

This guide assumes no programming experience. Plan on about 45 minutes.

---

## What you need before starting

You'll need three free accounts. Use the same email for all of them.

| Service | What it does | Sign up at |
|---|---|---|
| **GitHub** | Stores the website's code | github.com |
| **Supabase** | The database | supabase.com |
| **Netlify** | Hosts the website and sends the ticket alert emails | netlify.com |

---

## Step 1 — Put the code on GitHub

1. Sign in to GitHub and click **New repository**. Name it `roxberry-tickets`, choose **Private**, and click **Create repository**.
2. On the next page, click **uploading an existing file**.
3. Unzip the project folder on your computer, open it, select everything inside (including the `src` and `supabase` folders), and drag it into the browser window.
4. Click **Commit changes**.

---

## Step 2 — Set up the database (Supabase)

1. In Supabase, click **New project**. Name it `roxberry-tickets`, create a strong database password (save it somewhere safe), and pick the **West US** region. Wait a minute or two while it starts.
2. In the left sidebar, open **SQL Editor** and click **New query**.
3. Open the file `supabase/migrations/0001_schema.sql` from the project on your computer, copy all of it, paste it into the editor, and click **Run**. You should see "Success. No rows returned."
4. Click **New query** again, then do the same with `supabase/migrations/0002_seed.sql`. This loads **8 sample games** (real 2026–27 Jazz and Mammoth home games) for the mock site, and adds the administrators.
5. Do the same with `supabase/migrations/0003_password_login.sql`. This sets up username-and-password sign-in. Rae's username is `rae` and Chad's is `chad`.
   Then do the same with `0004_game_reminders.sql` and `0005_reservations.sql`, in that order. (Five files in total, 0001 through 0005.)
6. Open one more **New query** and give each of them a temporary password (10+ characters). Type your own in place of the examples, then click **Run**:

   ```sql
   select public.admin_set_password('rae',  'Example-Temp-111', true);
   select public.admin_set_password('chad', 'Example-Temp-222', true);
   ```

   Each person is asked to choose their own password the first time they sign in.
7. Go to **Project Settings → API Keys** and open the **Legacy API Keys** tab. Keep this tab open; you'll copy three values in Step 4. (Use the legacy keys, which start with `eyJ`. The newer `sb_…` keys don't work with this site.)
   - **Project URL**
   - **anon** key
   - **service_role** key (click "Reveal"). **Treat this like a password.** Never email it or paste it anywhere except Netlify.

> Supabase's free plan can pause a project that sees no activity for about a week. During the season the site will be in regular use, but if you'd rather never think about it, the Pro plan avoids pausing.

---

## Step 3 — (Nothing to do here)

Ticket alert emails are sent by Netlify itself, which you'll switch on in Step 5. There's no separate email service to set up.

---

## Step 4 — Put the website online (Netlify)

1. In Netlify, choose **Add new site → Import an existing project → GitHub**, and pick your `roxberry-tickets` repository. Netlify recognizes it automatically, so leave the build settings alone.
2. Before deploying, open **Add environment variables** (or after: **Site configuration → Environment variables**) and add these six:

| Name | Value | Mark as secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase **Project URL**, exactly `https://xxxx.supabase.co` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase legacy **anon** key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase legacy **service_role** key | **Yes** |
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-ROXBERRY-SITE.netlify.app` (no slash at the end) | No |

You won't know the exact site address until the first deploy. Use a placeholder, deploy, then update `NEXT_PUBLIC_SITE_URL` with the real address and choose **Deploys → Trigger deploy → Deploy site**. You can also rename the site under **Site configuration → Change site name**, or connect your own domain under **Domain management**.


---

## Step 5 — Turn on ticket alert emails (Netlify)

1. In Netlify, open your site and go to **Forms**. Click **Enable form detection**.
2. Go to **Deploys → Trigger deploy → Deploy site**. Detection takes effect on the next deploy.
3. Go back to **Forms**. You should now see a form called **ticket-allocated**.
4. Go to **Site configuration → Notifications → Emails and webhooks → Form submission notifications** and click **Add notification → Email notification**.
5. Enter `rseagle@millyresearch.com`, choose the form **ticket-allocated**, and save.
6. Repeat with `chad.pehrson@gmail.com`.

From now on, every time someone claims seats, both of you get an email listing the client's name and email, the game, the date and time, the number of tickets, and the seats left, plus a link to open the record in the dashboard.

Netlify's free plan includes 100 form submissions a month, which covers a season of ticket claims comfortably. To send alerts from an email account instead, see "Sending alerts from an email account" near the end.

---

## Step 6 — First sign-in and launch checklist

1. Visit `https://YOUR-ROXBERRY-SITE.netlify.app/admin` and sign in with your username and temporary password. You'll be asked to choose your own password right away.
3. Open **Games** and spot-check a few dates and times against utahjazz.com and the Mammoth's schedule on nhl.com.

**Before sharing the link, run through this once.** Use your own email addresses and a game you don't mind resetting.

- [ ] Request 1 ticket on the public site → you see the on-screen confirmation, and the people set up in Netlify's form notifications get an alert email (the client gets no email).
- [ ] Request the remaining 3 seats with a different email → confirmed, and the game shows **Sold Out**.
- [ ] Try to request another seat → the "someone beat you to those seats" message appears.
- [ ] In the dashboard, open one of those allocations and **Cancel** it → the seats reappear on the public site.
- [ ] Open the game, click **Close game**, cancel the other allocation → the game stays closed publicly.
- [ ] Check that both clients appear in **Clients** and on the **Calendar**.
- [ ] Open **Emails** in the dashboard and confirm the alert shows **Sent**.
- [ ] Sign out, then try visiting `/admin` → you're sent to the sign-in page.
- [ ] Clean up: reopen the game and archive the test clients.

The overbooking and duplicate-click protections have already been stress-tested (30 simultaneous requests for one game never produced more than 4 seats; 15 simultaneous duplicate clicks produced exactly 1 allocation).

---

## Day-to-day use

**Overview** shows totals, recent allocations and the next games. A red banner appears if any email failed.

**Calendar** shows both teams in month, week and list views. Click any game to see who's attending.

**Allocations** is a searchable table. Open one to:
- add notes or correct a client's name or email
- change the ticket count or reassign the tickets to another client
- cancel it (the seats go straight back on the public site)

None of these actions email the client, so let them know personally when something changes.

**Games** is where you add, edit, publish, unpublish, close or reopen games. You can also allocate seats to someone directly (useful after a phone call or text) or import a schedule from CSV. A game can't be lowered below the seats already given out; the site will tell you to cancel or reduce allocations first.

**Clients** is the directory. Clients are added automatically the first time they claim seats, and matched by email so the same person is never duplicated. You can also add them by hand or import a CSV.

**Emails** lists every ticket alert. Failed ones have a **Retry** button. Retrying only re-sends the alert and never changes anyone's tickets.

**Activity** is the full audit history: every allocation, cancellation, reassignment, inventory change and admin edit.

**Settings** covers:
- the public page wording and team colors
- administrators: add people (any email, or none), reset passwords, deactivate access
- CSV exports

### Things to add during the season

- **Jazz NBA Cup games:** two games between Dec. 4 and 11 were not yet scheduled when the season's schedule was released. Add them under **Games → Add game** once they're announced.

### CSV formats

**Games:**
```
team,opponent,date,time,venue,inventory,published
jazz,Denver Nuggets,2026-12-08,7:00 PM,Delta Center,4,yes
```
`team` is `jazz` or `mammoth`. The date can be `2026-12-08` or `12/8/2026`. Times are Salt Lake City time. Every 2026–27 home game for both teams is in `data/full-schedule-2026-27.csv`; copy the rows you need into a new CSV and import it.

**Clients:**
```
full_name,email,notes,active
Jane Smith,jane@example.com,Referred by Mark,yes
```

---

## How the site protects tickets and privacy

- **No overbooking, ever.** Every request locks the game in the database while seats are counted, so two people clicking at the same instant are handled one after the other. A second database rule rejects any change that would exceed a game's inventory, even one made by mistake.
- **No duplicate allocations.** Each form submission carries a one-time code, so double-clicks, retries and refreshes can't claim seats twice.
- **Remaining seats are always calculated**, never stored separately, so the count can't drift.
- **Private data stays private.** The public site only ever receives game details and seat counts. The database refuses all access from the public key; only the server, after checking who's asking, can read client information.
- **Spam protection.** There's a hidden trap field for bots, a minimum time to fill in the form, and limits on how many requests one connection or email can make in a short period.
- **Admin access** is checked on the server for every page and action, not just hidden behind a URL. Passwords are stored only as one-way bcrypt hashes, and repeated wrong guesses are slowed down.

---

## Three-week schedule window

The public page shows only games in the next 21 days (rolling, in Salt Lake City time), so clients see a short list of nearby games. Each day, the next game rolls into view on its own; nothing needs to be added weekly. Games further out can't be requested until they appear. You can change the number of days under **Settings → Defaults, colors and display**. The dashboard always shows the whole season.

## Game reminders (3 days before each game)

Every morning at about 9:00 AM (8:00 AM in winter), the site checks for games happening within the next 3 days and sends one reminder per game. It goes out whether or not anyone has claimed seats, so you can send tickets to clients or sell unclaimed ones. Each reminder lists:
- the game, date and time
- seats claimed and unclaimed, plus who has them
- a link to the game in the dashboard

**One-time setup:**
1. Make sure `0004_game_reminders.sql` was run during setup (Step 2).
2. After the site redeploys, Netlify's **Forms** page shows a second form, **game-reminder**.
3. In **Project configuration → Notifications → Form submission notifications**, add an **Email notification** for the form **game-reminder** to `rseagle@millyresearch.com`.
4. Under **Logs → Functions**, you'll see a function named **game-reminders** with a daily schedule.

Each game is reminded only once. Its page in the dashboard shows when the reminder went out, with a **Send reminder now** button for testing or for a second nudge. Failed reminders appear under **Emails** with a **Retry** button. You can change "3 days" under **Settings**.

## Reserving seats (no email sent)

To hold seats for someone without emailing anyone, for example after a phone call, or seats sold or given away directly:

1. Open the game in the dashboard (**Games**, or click it on the **Calendar**).
2. Under **Reserve seats**, choose the number of seats and type the name they're reserved for. You can also pick someone already in the client list.
3. Email is optional. Add a note if you like ("Store manager," "sold for $200").
4. Click **Reserve seats**.

The seats come off the public availability immediately. They're labeled **Reserved** everywhere, with the name of the admin who made the reservation, and they appear in game reminders. Website requests are labeled **Claimed**. To undo a reservation, open it and click **Cancel allocation**.

This needs `0005_reservations.sql`, which you run during setup (Step 2).

## Administrators and passwords

- Everyone signs in at `/admin/login` with their own username and password. Admins don't need any particular email address.
- **Add someone:** Settings → Administrators → enter a username, an optional email, and a temporary password. Share the temporary password privately; they'll pick their own when they first sign in.
- **Forgot a password:** another administrator opens Settings → Administrators → **Reset password** next to that person's name.
- **Change your own password:** click your username at the top right of the dashboard.
- **Remove access:** click **Deactivate**. That person is signed out immediately.
- After 10 wrong attempts in 15 minutes, sign-in pauses briefly to stop password guessing.
- If every administrator is ever locked out, reset a password in Supabase's SQL Editor:
  `select public.admin_set_password('rae', 'New-Temp-Password', true);`

## Sending alerts from an email account (optional)

Netlify Forms is the default. To send alerts from a regular email account instead, add these in Netlify and redeploy:

| Name | Example for Gmail |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | the Gmail address |
| `SMTP_PASS` | a Gmail **App Password** (Google Account → Security → App passwords; needs 2-Step Verification) — mark as secret |
| `EMAIL_FROM` | `Roxberry Juice Co. Tickets <the Gmail address>` |

When these are present, alerts go to the addresses in **Settings → Notification recipients**.

## Troubleshooting

**The home page says "The schedule could not be loaded."** Check that `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://xxxx.supabase.co` and that you're using the legacy `eyJ…` keys, then redeploy.

**Alerts show "failed" in the Emails page.** Make sure form detection is on (Step 5) and that the latest deploy happened after turning it on. Then click **Retry** — it re-sends the alert without touching anyone's tickets. Also check Netlify's **Forms** page for submissions marked as spam.

**"That username and password don't match."** Usernames aren't case-sensitive; passwords are. Ask another admin to reset it.

**Changes to environment variables aren't showing up.** Netlify only applies them on a new deploy: **Deploys → Trigger deploy**.

---

## For a developer

This is a Next.js 14 (App Router) and TypeScript app with Tailwind. It uses Supabase Postgres (accessed only server-side), username/password admin sessions (bcrypt via pgcrypto, SHA-256-hashed session tokens in `admin_sessions`, httpOnly cookie), and Netlify Forms notifications for alerts, with optional SMTP via nodemailer.

- All database access happens server-side with the service-role key; row-level security is enabled with no policies, and grants are revoked from `anon` and `authenticated`.
- Ticket allocation runs in `allocate_tickets()` (`SELECT … FOR UPDATE` on the game row), backed by a `BEFORE INSERT/UPDATE` trigger guard.
- The public page polls `/api/games` every 20 seconds and on window focus.
- Local development: `npm install`, copy `.env.example` to `.env.local`, then `npm run dev`.

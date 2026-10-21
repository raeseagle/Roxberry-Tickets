// Netlify Scheduled Function: runs every day at 15:00 UTC
// (9:00 AM in Salt Lake City during daylight time, 8:00 AM in winter).
// It asks the website to send any game reminders that are due.
export default async () => {
  const site = process.env.URL; // Netlify sets this to the site's main address
  const res = await fetch(`${site}/api/cron/reminders`, { method: 'POST' });
  const body = await res.text();
  console.log(`Game reminders: HTTP ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: '0 15 * * *' };

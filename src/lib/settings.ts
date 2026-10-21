import 'server-only';
import { db } from './supabase/admin';

export type AppSettings = {
  seasonLabel: string;
  headline: string;
  /** Use *asterisks* for italics. Blank line = new paragraph. */
  intro: string;
  disclaimer: string;
  privacyNotice: string;
  defaultInventory: number;
  /** Public page shows games this many days ahead (rolling window). */
  publicWindowDays: number;
  /** Send the game reminder this many days before each game. */
  reminderDaysBefore: number;
  /** Where reminders go when sending by SMTP (Netlify Forms recipients are set in Netlify). */
  reminderRecipient: string;
  notificationRecipients: string[];
  teamColors: {
    jazz: { primary: string; accent: string };
    mammoth: { primary: string; accent: string };
  };
  display: {
    showVenue: boolean;
    showTotalInventory: boolean;
    defaultTab: 'jazz' | 'mammoth';
  };
  email: {
    internalSubject: string;
    clientConfirmSubject: string;
    clientConfirmIntro: string;
    clientCancelSubject: string;
    clientCancelIntro: string;
    clientChangeSubject: string;
    clientChangeIntro: string;
    signature: string;
  };
};

export const DEFAULT_SETTINGS: AppSettings = {
  seasonLabel: '2026–27 SEASON | DELTA CENTER | SALT LAKE CITY',
  headline: 'Thank You for All You Do.',
  intro:
    'Thank you for all you do for Roxberry. As a small thank-you, the next game is on us.\n\nPick one of the open games below, enter your name and email, and the seats are yours.',
  disclaimer:
    'Tickets are complimentary and available on a first-come, first-served basis. Your request is confirmed once successfully submitted, provided enough seats remain available.',
  privacyNotice:
    'The name and email address you submit are used only to manage your ticket request and to send you related messages about it. They are visible only to the Roxberry team and are never shown to other visitors or shared.',
  defaultInventory: 4,
  publicWindowDays: 21,
  reminderDaysBefore: 3,
  reminderRecipient: 'rseagle@millyresearch.com',
  notificationRecipients: ['rseagle@millyresearch.com', 'chad.pehrson@gmail.com'],
  teamColors: {
    jazz: { primary: '#F9A01B', accent: '#FCD58C' },
    mammoth: { primary: '#8FD0F5', accent: '#CFEBFB' },
  },
  display: { showVenue: true, showTotalInventory: true, defaultTab: 'jazz' },
  email: {
    internalSubject: 'Tickets Allocated — {team} vs. {opponent} — {date}',
    clientConfirmSubject: "You're in: {team} vs. {opponent} on {date}",
    clientConfirmIntro:
      'Good news — your seats are confirmed. The Roxberry team will be in touch with ticket delivery details before the game.',
    clientCancelSubject: 'Update on your tickets: {team} vs. {opponent}',
    clientCancelIntro:
      'Your ticket allocation for this game has been cancelled. If you think this is a mistake, just reply to this email.',
    clientChangeSubject: 'Your tickets were updated: {team} vs. {opponent}',
    clientChangeIntro: 'Your ticket allocation for this game has changed. The current details are below.',
    signature: '— The Roxberry Juice Co. team',
  },
};

function merge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? merge(b, v) : v ?? b;
  }
  return out as T;
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const { data } = await db().from('settings').select('value').eq('key', 'app').maybeSingle();
    return merge(DEFAULT_SETTINGS, data?.value);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const current = await getSettings();
  const next = merge(current, patch);
  const { error } = await db()
    .from('settings')
    .upsert({ key: 'app', value: next, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return next;
}

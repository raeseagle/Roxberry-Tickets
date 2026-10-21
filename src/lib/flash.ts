import { redirect } from 'next/navigation';

/** Redirect back to a page with a success or error banner. */
export function done(path: string, msg: string): never {
  // `t` changes on every success so forms on the page start fresh (no leftover entries).
  redirect(`${path}${path.includes('?') ? '&' : '?'}msg=${encodeURIComponent(msg)}&t=${Date.now()}`);
}
export function oops(path: string, err: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}err=${encodeURIComponent(err)}`);
}

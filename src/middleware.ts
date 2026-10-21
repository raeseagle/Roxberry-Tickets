import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'tickets_admin_session';

/**
 * First gate only: sends visitors without a sign-in cookie to the login page.
 * Every admin page, action and API route re-checks the session and the
 * admins table on the server (lib/auth.ts).
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  if (path.startsWith('/api/admin')) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };

import { NextResponse, type NextRequest } from 'next/server';

// Email sign-in links are no longer used; administrators sign in with a username and password.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/admin/login', request.nextUrl.origin));
}

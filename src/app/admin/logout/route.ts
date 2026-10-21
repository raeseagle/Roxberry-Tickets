import { NextResponse, type NextRequest } from 'next/server';
import { endSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  await endSession();
  return NextResponse.redirect(new URL('/admin/login', request.nextUrl.origin), { status: 303 });
}

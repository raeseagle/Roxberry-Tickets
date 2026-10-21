import { NextResponse } from 'next/server';
import { getPublicGames } from '@/lib/games';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettings();
    const games = await getPublicGames(settings.publicWindowDays);
    return NextResponse.json({ games }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load games.' }, { status: 500 });
  }
}

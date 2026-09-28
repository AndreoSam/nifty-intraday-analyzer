import { NextResponse } from 'next/server';
import { getNews } from '@/lib/news';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getNews());
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'News scan failed' }, { status: 502 });
  }
}

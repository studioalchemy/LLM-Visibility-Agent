import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/runAgent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  try {
    const summary = await runAgent('manual');
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

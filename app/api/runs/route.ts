import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from('runs')
      .select('id, triggered_by, status, started_at, completed_at, our_brand_sov')
      .order('started_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    return NextResponse.json({ runs: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

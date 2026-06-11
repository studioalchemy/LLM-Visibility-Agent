import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { loadConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

const ALLOWED = [1, 3, 7, 14, 30];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const days = Number(body.frequency_days);
    if (!ALLOWED.includes(days)) {
      return NextResponse.json(
        { error: `frequency_days must be one of ${ALLOWED.join(',')}` },
        { status: 400 },
      );
    }
    const cfg = await loadConfig();
    if (!cfg) return NextResponse.json({ error: 'no config row' }, { status: 404 });

    // Recompute next_run_at from now whenever frequency changes.
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + days);

    const sb = getServerSupabase();
    const { data, error } = await sb
      .from('agent_config')
      .update({
        frequency_days: days,
        next_run_at: next.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cfg.id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ config: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

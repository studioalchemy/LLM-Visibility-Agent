import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { loadConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export async function POST() {
  try {
    const cfg = await loadConfig();
    if (!cfg) return NextResponse.json({ error: 'no config row' }, { status: 404 });
    const sb = getServerSupabase();
    const now = new Date().toISOString();

    // Toggle is_active. When turning ON: reset last_activated_at and push next_run_at
    // to now + frequency_days (schedule restarts from today, no immediate run).
    // When turning OFF: leave next_run_at; cron will skip while is_active=false.
    const next = !cfg.is_active;
    const updates: any = {
      is_active: next,
      updated_at: now,
    };
    if (next) {
      updates.last_activated_at = now;
      updates.next_run_at = addDays(cfg.frequency_days);
    }

    const { data, error } = await sb
      .from('agent_config')
      .update(updates)
      .eq('id', cfg.id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ config: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

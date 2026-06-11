import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { loadConfig } from '@/lib/config';
import { runAgent } from '@/lib/runAgent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Accept Authorization: Bearer <secret> OR X-Cron-Secret: <secret>
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-cron-secret') === secret) return true;
  return false;
}

async function tick() {
  const cfg = await loadConfig();
  if (!cfg) return { skipped: true, reason: 'no config' };
  if (!cfg.is_active) return { skipped: true, reason: 'inactive' };

  const now = Date.now();
  const next = new Date(cfg.next_run_at).getTime();
  if (next > now) {
    return { skipped: true, reason: 'not due', next_run_at: cfg.next_run_at };
  }

  const summary = await runAgent('scheduled');

  // Advance next_run_at by frequency_days
  const newNext = new Date();
  newNext.setUTCDate(newNext.getUTCDate() + cfg.frequency_days);
  const sb = getServerSupabase();
  await sb
    .from('agent_config')
    .update({ next_run_at: newNext.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', cfg.id);

  return { ran: true, run_id: summary.run_id, next_run_at: newNext.toISOString() };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await tick();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

// Allow Vercel Cron's GET as well (it uses GET by default).
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await tick();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

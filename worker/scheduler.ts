// Local/self-hosted polling worker. Runs the same logic as /api/cron/tick.
// Usage: `npm run worker` (with .env loaded by your shell or a wrapper like dotenv-cli).
import cron from 'node-cron';
import { loadConfig } from '../lib/config';
import { runAgent } from '../lib/runAgent';
import { getServerSupabase } from '../lib/supabase';

async function tick() {
  try {
    const cfg = await loadConfig();
    if (!cfg) {
      console.log('[worker] no config row');
      return;
    }
    if (!cfg.is_active) {
      console.log('[worker] agent inactive — skipping');
      return;
    }
    const now = Date.now();
    const next = new Date(cfg.next_run_at).getTime();
    if (next > now) {
      console.log(`[worker] not due yet (next ${cfg.next_run_at})`);
      return;
    }
    console.log('[worker] running scheduled agent…');
    const summary = await runAgent('scheduled');
    const newNext = new Date();
    newNext.setUTCDate(newNext.getUTCDate() + cfg.frequency_days);
    await getServerSupabase()
      .from('agent_config')
      .update({ next_run_at: newNext.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', cfg.id);
    console.log(`[worker] completed run ${summary.run_id}; next run ${newNext.toISOString()}`);
  } catch (e: any) {
    console.error('[worker] error:', e?.message ?? e);
  }
}

console.log('[worker] starting hourly scheduler…');
// Run immediately once at startup, then every hour.
tick();
cron.schedule('0 * * * *', tick);

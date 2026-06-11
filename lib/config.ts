import { getServerSupabase } from './supabase';
import type { AgentConfig } from './types';

export async function loadConfig(): Promise<AgentConfig | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('agent_config')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AgentConfig | null;
}

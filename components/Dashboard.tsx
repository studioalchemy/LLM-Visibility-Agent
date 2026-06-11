'use client';

import { useCallback, useEffect, useState } from 'react';
import TopBar from './TopBar';
import FrequencySlider from './FrequencySlider';
import PromptManager from './PromptManager';
import RecipientManager from './RecipientManager';
import RunPanel from './RunPanel';
import ResultsView from './ResultsView';
import TrendsView from './TrendsView';
import BrandConfig from './BrandConfig';
import type { AgentConfig, Prompt, Recipient, RunSummary } from '@/lib/types';
import { useToast } from './Toast';

export default function Dashboard() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [lastResult, setLastResult] = useState<RunSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  const loadAll = useCallback(async () => {
    try {
      const [c, p, r] = await Promise.all([
        fetch('/api/config').then((x) => x.json()),
        fetch('/api/prompts').then((x) => x.json()),
        fetch('/api/recipients').then((x) => x.json()),
      ]);
      setConfig(c.config ?? null);
      setPrompts(p.prompts ?? []);
      setRecipients(r.recipients ?? []);
    } catch (e: any) {
      push(`load failed: ${e?.message ?? e}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="pixel-spinner" />
          <span className="silk text-muted">BOOTING AGENT_04…</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel p-6 max-w-lg">
          <h2 className="pixel-h text-accent text-sm mb-3">CONFIG MISSING</h2>
          <p className="text-muted text-sm">
            Supabase is not reachable or the migration has not run. Check `.env.local` and run the
            SQL in `supabase/migrations/0001_init.sql`.
          </p>
        </div>
      </div>
    );
  }

  const isActive = config.is_active;

  return (
    <div className="min-h-screen pb-24">
      <TopBar
        config={config}
        onToggle={async () => {
          const r = await fetch('/api/agent/toggle', { method: 'POST' });
          const j = await r.json();
          if (j.config) {
            setConfig(j.config);
            push(
              j.config.is_active
                ? `AGENT LIVE — next run in ${j.config.frequency_days} days`
                : 'AGENT OFFLINE — schedule paused',
              j.config.is_active ? 'success' : 'info',
            );
          } else {
            push(`toggle failed: ${j.error ?? 'unknown'}`, 'error');
          }
        }}
      />

      <main className={`max-w-6xl mx-auto px-4 sm:px-6 mt-6 grid gap-6 ${!isActive ? '' : ''}`}>
        {!isActive && (
          <div className="panel p-3 border-accent text-accent silk text-xs">
            ◉ AGENT OFFLINE — schedule paused. Toggle the kill switch to resume.
          </div>
        )}

        <div className={!isActive ? 'killed-dim grid gap-6' : 'grid gap-6'}>
          <section className="grid gap-6 md:grid-cols-2">
            <BrandConfig
              config={config}
              onSaved={(c) => {
                setConfig(c);
                push('CONFIG SAVED', 'success');
              }}
            />
            <FrequencySlider
              config={config}
              onChanged={(c) => {
                setConfig(c);
                push(`FREQUENCY SET — next run ${new Date(c.next_run_at).toLocaleString()}`, 'success');
              }}
            />
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <PromptManager
              prompts={prompts}
              setPrompts={setPrompts}
            />
            <RecipientManager
              recipients={recipients}
              setRecipients={setRecipients}
            />
          </section>

          <RunPanel
            onResult={(r) => {
              setLastResult(r);
              push('RUN COMPLETE', 'success');
            }}
          />

          {lastResult && <ResultsView summary={lastResult} />}

          <TrendsView />
        </div>
      </main>
    </div>
  );
}

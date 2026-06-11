'use client';

import { useMemo, useState } from 'react';
import type { AgentConfig } from '@/lib/types';
import { useToast } from './Toast';

const STOPS = [1, 3, 7, 14, 30];
const LABELS = ['DAILY', 'EVERY 3', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'];

export default function FrequencySlider({
  config,
  onChanged,
}: {
  config: AgentConfig;
  onChanged: (c: AgentConfig) => void;
}) {
  const initialIdx = Math.max(0, STOPS.indexOf(config.frequency_days));
  const [idx, setIdx] = useState(initialIdx === -1 ? 2 : initialIdx);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const pct = useMemo(() => (idx / (STOPS.length - 1)) * 100, [idx]);

  const apply = async (newIdx: number) => {
    setIdx(newIdx);
    setBusy(true);
    try {
      const r = await fetch('/api/agent/frequency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency_days: STOPS[newIdx] }),
      });
      const j = await r.json();
      if (j.config) onChanged(j.config);
      else push(`frequency update failed: ${j.error ?? 'unknown'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="pixel-h text-[11px] text-accent">CADENCE</h3>
        <span className="silk text-[10px] text-muted">{LABELS[idx]}</span>
      </div>

      <div className="freq-track">
        <div className="freq-fill" style={{ width: `${pct}%` }} />
        <div className="freq-handle" style={{ left: `${pct}%` }} />
      </div>

      <div className="mt-3 flex justify-between text-[10px] silk text-muted">
        {STOPS.map((s, i) => (
          <button
            key={s}
            onClick={() => apply(i)}
            disabled={busy}
            className={`px-2 py-1 ${i === idx ? 'text-accent' : 'hover:text-text'}`}
          >
            {s}D
          </button>
        ))}
      </div>

      <div className="mt-4 text-xs text-muted">
        next run:{' '}
        <span className="text-text">
          {config.next_run_at ? new Date(config.next_run_at).toLocaleString() : '—'}
        </span>
      </div>
    </div>
  );
}

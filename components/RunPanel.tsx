'use client';

import { useEffect, useRef, useState } from 'react';
import type { RunSummary } from '@/lib/types';
import { useToast } from './Toast';

const STAGES = [
  'querying openai…',
  'querying perplexity…',
  'querying gemini…',
  'querying claude…',
  'extracting brands…',
  'computing share of voice…',
  'building report…',
  'sending email…',
];

export default function RunPanel({ onResult }: { onResult: (r: RunSummary) => void }) {
  const [busy, setBusy] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { push } = useToast();

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setStageIdx(0);
    timerRef.current = setInterval(() => {
      setStageIdx((i) => Math.min(STAGES.length - 1, i + 1));
    }, 1800);

    try {
      const r = await fetch('/api/run', { method: 'POST' });
      const j = await r.json();
      if (j.summary) {
        onResult(j.summary as RunSummary);
      } else {
        push(`run failed: ${j.error ?? 'unknown'}`, 'error');
      }
    } catch (e: any) {
      push(`run failed: ${e?.message ?? e}`, 'error');
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
      <div>
        <h3 className="pixel-h text-[11px] text-accent mb-2">EXECUTE</h3>
        <p className="text-sm text-muted">
          Run all active prompts × 4 providers now. Schedule unchanged.
        </p>
        {busy && (
          <div className="mt-3 flex items-center gap-2 text-xs silk text-muted">
            <span className="pixel-spinner" />
            <span className="text-accent">{STAGES[stageIdx]}</span>
          </div>
        )}
      </div>
      <button onClick={run} disabled={busy} className="btn-accent text-xs sm:text-sm">
        {busy ? 'RUNNING…' : '▶ RUN NOW'}
      </button>
    </div>
  );
}

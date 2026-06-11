'use client';

import { useEffect, useState } from 'react';
import type { AgentConfig } from '@/lib/types';
import { useToast } from './Toast';

export default function BrandConfig({
  config,
  onSaved,
}: {
  config: AgentConfig;
  onSaved: (c: AgentConfig) => void;
}) {
  const [brand, setBrand] = useState(config.our_brand);
  const [category, setCategory] = useState(config.category);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    setBrand(config.our_brand);
    setCategory(config.category);
  }, [config.our_brand, config.category]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ our_brand: brand, category }),
      });
      const j = await r.json();
      if (j.config) onSaved(j.config);
      else push(`save failed: ${j.error ?? 'unknown'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5">
      <h3 className="pixel-h text-[11px] text-accent mb-4">BRAND // CATEGORY</h3>
      <div className="grid gap-3">
        <label className="silk text-[10px] text-muted">OUR BRAND</label>
        <input
          className="input-pixel"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Britannia Bourbon"
        />
        <label className="silk text-[10px] text-muted mt-2">CATEGORY</label>
        <input
          className="input-pixel"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. cream biscuits in India"
        />
        <div className="mt-3">
          <button onClick={save} disabled={busy} className="btn-pixel">
            {busy ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

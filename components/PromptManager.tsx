'use client';

import { useState } from 'react';
import type { Prompt } from '@/lib/types';
import { useToast } from './Toast';

export default function PromptManager({
  prompts,
  setPrompts,
}: {
  prompts: Prompt[];
  setPrompts: (p: Prompt[]) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const optimistic: Prompt = {
      id: `tmp-${Date.now()}`,
      prompt_text: t,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const prev = prompts;
    setPrompts([optimistic, ...prompts]);
    setText('');
    try {
      const r = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_text: t }),
      });
      const j = await r.json();
      if (j.prompt) {
        setPrompts([j.prompt, ...prev]);
        push('PROMPT ADDED', 'success');
      } else {
        setPrompts(prev);
        push(`add failed: ${j.error ?? 'unknown'}`, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const prev = prompts;
    setPrompts(prompts.filter((p) => p.id !== id));
    try {
      const r = await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j.ok) {
        setPrompts(prev);
        push(`delete failed: ${j.error ?? 'unknown'}`, 'error');
      }
    } catch (e: any) {
      setPrompts(prev);
      push(`delete failed: ${e?.message ?? e}`, 'error');
    }
  };

  const toggle = async (p: Prompt) => {
    const next = !p.is_active;
    const prev = prompts;
    setPrompts(prompts.map((x) => (x.id === p.id ? { ...x, is_active: next } : x)));
    try {
      const r = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, is_active: next }),
      });
      const j = await r.json();
      if (!j.prompt) {
        setPrompts(prev);
        push(`toggle failed: ${j.error ?? 'unknown'}`, 'error');
      }
    } catch (e: any) {
      setPrompts(prev);
      push(`toggle failed: ${e?.message ?? e}`, 'error');
    }
  };

  return (
    <div className="panel p-5">
      <h3 className="pixel-h text-[11px] text-accent mb-4">PROMPTS</h3>

      <div className="flex gap-2 mb-4">
        <input
          className="input-pixel flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder='e.g. "best cream biscuits in India"'
        />
        <button onClick={add} disabled={busy || !text.trim()} className="btn-pixel">
          + ADD
        </button>
      </div>

      {prompts.length === 0 ? (
        <div className="border border-border p-6 text-center silk text-[10px] text-muted">
          NO PROMPTS // ADD ONE TO BEGIN
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {prompts.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 p-3 hover:bg-surface-2 transition-snappy"
            >
              <button
                onClick={() => toggle(p)}
                className={`led ${p.is_active ? 'led-on' : 'led-off'}`}
                title={p.is_active ? 'active' : 'paused'}
              />
              <span className={`flex-1 text-sm ${p.is_active ? 'text-text' : 'text-muted line-through'}`}>
                {p.prompt_text}
              </span>
              <button
                onClick={() => remove(p.id)}
                className="text-muted hover:text-accent transition-snappy text-sm"
                aria-label="delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

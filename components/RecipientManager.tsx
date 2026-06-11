'use client';

import { useState } from 'react';
import type { Recipient } from '@/lib/types';
import { useToast } from './Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecipientManager({
  recipients,
  setRecipients,
}: {
  recipients: Recipient[];
  setRecipients: (r: Recipient[]) => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      push('INVALID EMAIL', 'error');
      return;
    }
    if (recipients.some((r) => r.email.toLowerCase() === e)) {
      push('ALREADY ADDED', 'info');
      return;
    }
    setBusy(true);
    const optimistic: Recipient = {
      id: `tmp-${Date.now()}`,
      email: e,
      created_at: new Date().toISOString(),
    };
    const prev = recipients;
    setRecipients([optimistic, ...recipients]);
    setEmail('');
    try {
      const r = await fetch('/api/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      });
      const j = await r.json();
      if (j.recipient) {
        setRecipients([j.recipient, ...prev]);
        push('RECIPIENT ADDED', 'success');
      } else {
        setRecipients(prev);
        push(`add failed: ${j.error ?? 'unknown'}`, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const prev = recipients;
    setRecipients(recipients.filter((r) => r.id !== id));
    try {
      const r = await fetch(`/api/recipients?id=${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j.ok) {
        setRecipients(prev);
        push(`delete failed: ${j.error ?? 'unknown'}`, 'error');
      }
    } catch (err: any) {
      setRecipients(prev);
      push(`delete failed: ${err?.message ?? err}`, 'error');
    }
  };

  return (
    <div className="panel p-5">
      <h3 className="pixel-h text-[11px] text-accent mb-4">RECIPIENTS</h3>
      <p className="text-[11px] text-muted mb-3">
        .docx report delivered to all listed addresses after every run.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          className="input-pixel flex-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="ops@company.com"
          type="email"
        />
        <button onClick={add} disabled={busy} className="btn-pixel">
          + ADD
        </button>
      </div>

      {recipients.length === 0 ? (
        <div className="border border-border p-6 text-center silk text-[10px] text-muted">
          NO RECIPIENTS // ADD ONE TO RECEIVE REPORTS
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {recipients.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 p-3 hover:bg-surface-2 transition-snappy"
            >
              <span className="led led-on" />
              <span className="flex-1 text-sm">{r.email}</span>
              <button
                onClick={() => remove(r.id)}
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

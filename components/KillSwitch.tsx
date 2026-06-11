'use client';

import { useState } from 'react';

export default function KillSwitch({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await onToggle();
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className={`group select-none transition-snappy duration-snappy flex items-center gap-3 px-4 py-3 border ${
        active
          ? 'border-accent bg-accent/15 shadow-glow'
          : 'border-border bg-surface-2'
      }`}
      title="Toggle kill switch"
    >
      <span className={`led ${active ? 'led-on' : 'led-off'}`} />
      <span className="pixel-h text-[10px] sm:text-xs">
        {active ? '● LIVE' : '○ KILLED'}
      </span>
    </button>
  );
}

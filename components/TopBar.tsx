'use client';

import KillSwitch from './KillSwitch';
import type { AgentConfig } from '@/lib/types';

export default function TopBar({
  config,
  onToggle,
}: {
  config: AgentConfig;
  onToggle: () => void | Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-bg/85 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`led ${config.is_active ? 'led-on' : 'led-off'}`} />
          <h1 className="pixel-h text-xs sm:text-sm leading-tight">
            AGENT_04 <span className="text-accent">//</span>{' '}
            <span className="text-muted">LLM SHARE OF VOICE</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="chip">
            <span className="text-muted">BRAND</span>
            <span className="text-text">{config.our_brand || '—'}</span>
          </div>
          <div className="chip">
            <span className="text-muted">CAT</span>
            <span className="text-text">{config.category || '—'}</span>
          </div>
          <div className="chip">
            <span className="text-muted">NEXT</span>
            <span className="text-text">
              {config.next_run_at
                ? new Date(config.next_run_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>
          <KillSwitch active={config.is_active} onToggle={onToggle} />
        </div>
      </div>
    </header>
  );
}

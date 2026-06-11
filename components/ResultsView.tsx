'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RunSummary } from '@/lib/types';
import { PROVIDERS } from '@/lib/types';

function pct(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export default function ResultsView({ summary }: { summary: RunSummary }) {
  const delta = summary.delta_sov;
  const deltaLabel =
    delta === null || delta === undefined
      ? '—'
      : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;

  const providerChartData = summary.per_provider.map((p) => ({
    provider: p.provider,
    sov: Math.round(p.sov * 1000) / 10,
  }));

  return (
    <div className="grid gap-6">
      {/* Headline */}
      <div className="panel p-6">
        <div className="grid sm:grid-cols-3 gap-6">
          <div>
            <div className="silk text-[10px] text-muted">OVERALL SOV</div>
            <div className="pixel-h text-3xl text-accent mt-2">{pct(summary.overall_sov)}</div>
            <div
              className={`silk text-[11px] mt-2 ${
                delta == null ? 'text-muted' : delta >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              Δ {deltaLabel} <span className="text-muted">vs last run</span>
            </div>
          </div>
          <div>
            <div className="silk text-[10px] text-muted">AVG POSITION</div>
            <div className="pixel-h text-2xl mt-2">
              {summary.our_avg_position == null ? '—' : `#${summary.our_avg_position.toFixed(1)}`}
            </div>
            <div className="silk text-[11px] text-muted mt-2">
              {summary.total_mentions} TOTAL MENTIONS
            </div>
          </div>
          <div>
            <div className="silk text-[10px] text-muted">BRANDS SEEN</div>
            <div className="pixel-h text-2xl mt-2">{summary.total_brands}</div>
            <div className="silk text-[11px] text-muted mt-2">
              EMAILED TO {summary.emailed_to.length}
            </div>
          </div>
        </div>
      </div>

      {/* SoV by provider */}
      <div className="panel p-5">
        <h3 className="pixel-h text-[11px] text-accent mb-4">SOV BY PROVIDER</h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={providerChartData}>
              <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" />
              <XAxis dataKey="provider" tick={{ fill: '#8A8A8A', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{
                  background: '#151515',
                  border: '1px solid #2A2A2A',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="sov" fill="#E0202E">
                {providerChartData.map((_, i) => (
                  <Cell key={i} fill="#E0202E" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {summary.per_provider.map((p) => (
            <div key={p.provider} className="panel-2 p-2">
              <div className="silk text-[10px] text-muted">{p.provider}</div>
              <div className="text-sm">{pct(p.sov)}</div>
              <div className="text-[10px] text-muted">
                {p.our_avg_position == null ? 'no mention' : `avg #${p.our_avg_position.toFixed(1)}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-prompt grid */}
      <div className="panel p-5">
        <h3 className="pixel-h text-[11px] text-accent mb-4">PROMPT × PROVIDER</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted silk text-[10px]">
                <th className="text-left p-2 border-b border-border">PROMPT</th>
                {PROVIDERS.map((p) => (
                  <th key={p} className="p-2 border-b border-border">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.prompt_results.map((pr, idx) => (
                <tr key={idx} className="border-b border-border">
                  <td className="p-2 text-text">{pr.prompt}</td>
                  {PROVIDERS.map((p) => {
                    const cell = pr.byProvider[p];
                    return (
                      <td key={p} className="p-2 text-center">
                        {cell?.appeared ? (
                          <span className="text-accent">#{cell.position}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitors + sentiment */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="panel p-5">
          <h3 className="pixel-h text-[11px] text-accent mb-4">TOP COMPETITORS</h3>
          {summary.competitors.length === 0 ? (
            <div className="silk text-[10px] text-muted">NO COMPETITORS DETECTED</div>
          ) : (
            <ul className="divide-y divide-border">
              {summary.competitors.slice(0, 10).map((c) => (
                <li key={c.brand} className="flex items-center justify-between py-2 text-sm">
                  <span>{c.brand}</span>
                  <span className="text-muted text-xs">
                    {c.mentions}× · {c.avg_position == null ? '—' : `avg #${c.avg_position.toFixed(1)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h3 className="pixel-h text-[11px] text-accent mb-4">SENTIMENT // OUR BRAND</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="panel-2 p-3">
              <div className="silk text-[10px] text-positive">POSITIVE</div>
              <div className="text-xl mt-1">{summary.sentiment.positive}</div>
            </div>
            <div className="panel-2 p-3">
              <div className="silk text-[10px] text-muted">NEUTRAL</div>
              <div className="text-xl mt-1">{summary.sentiment.neutral}</div>
            </div>
            <div className="panel-2 p-3">
              <div className="silk text-[10px] text-negative">NEGATIVE</div>
              <div className="text-xl mt-1">{summary.sentiment.negative}</div>
            </div>
          </div>
          {summary.snippets.length > 0 && (
            <div className="mt-4 grid gap-2">
              <div className="silk text-[10px] text-muted">SAMPLE LANGUAGE</div>
              {summary.snippets.slice(0, 4).map((s, i) => (
                <div key={i} className="panel-2 p-2 text-xs">
                  <span className="silk text-[10px] text-accent">{s.provider}</span>{' '}
                  <span className="text-muted">[{s.sentiment}]</span>{' '}
                  <span>"{s.snippet}"</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {summary.errors.length > 0 && (
        <div className="panel p-5 border-accent">
          <h3 className="pixel-h text-[11px] text-accent mb-3">PROVIDER ERRORS</h3>
          <ul className="text-xs text-muted divide-y divide-border">
            {summary.errors.map((e, i) => (
              <li key={i} className="py-2">
                <span className="text-accent">[{e.provider}]</span> {e.prompt} — {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="silk text-[10px] text-muted">
        REPORT EMAILED TO: {summary.emailed_to.length ? summary.emailed_to.join(', ') : '— (no recipients configured)'}
      </div>
    </div>
  );
}

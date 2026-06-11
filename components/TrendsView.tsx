'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type RunRow = {
  id: string;
  triggered_by: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  our_brand_sov: number | null;
};

export default function TrendsView() {
  const [runs, setRuns] = useState<RunRow[] | null>(null);

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((j) => setRuns(j.runs ?? []))
      .catch(() => setRuns([]));
  }, []);

  if (runs == null) {
    return (
      <div className="panel p-5">
        <h3 className="pixel-h text-[11px] text-accent mb-4">TRENDS</h3>
        <div className="silk text-[10px] text-muted">LOADING…</div>
      </div>
    );
  }

  const completed = runs.filter((r) => r.status === 'completed' && r.our_brand_sov != null);
  const chart = completed
    .slice()
    .reverse()
    .map((r) => ({
      date: new Date(r.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      sov: Math.round((r.our_brand_sov ?? 0) * 1000) / 10,
    }));

  return (
    <div className="grid gap-6">
      <div className="panel p-5">
        <h3 className="pixel-h text-[11px] text-accent mb-4">SOV OVER TIME</h3>
        {chart.length === 0 ? (
          <div className="silk text-[10px] text-muted">NO HISTORY YET // RUN THE AGENT TO SEE TRENDS</div>
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#8A8A8A', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: '#151515',
                    border: '1px solid #2A2A2A',
                    fontFamily: 'JetBrains Mono',
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="sov" stroke="#E0202E" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel p-5">
        <h3 className="pixel-h text-[11px] text-accent mb-4">RUN HISTORY</h3>
        {runs.length === 0 ? (
          <div className="silk text-[10px] text-muted">NO RUNS YET</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="silk text-[10px] text-muted">
                <tr>
                  <th className="text-left p-2 border-b border-border">DATE</th>
                  <th className="text-left p-2 border-b border-border">TRIGGER</th>
                  <th className="text-left p-2 border-b border-border">STATUS</th>
                  <th className="text-right p-2 border-b border-border">SOV</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="p-2">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="p-2">{r.triggered_by}</td>
                    <td className="p-2">
                      <span
                        className={
                          r.status === 'completed'
                            ? 'text-positive'
                            : r.status === 'failed'
                            ? 'text-negative'
                            : 'text-muted'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {r.our_brand_sov == null ? '—' : `${(r.our_brand_sov * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

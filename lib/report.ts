import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { getServerSupabase } from './supabase';
import type { AgentConfig, RunSummary, Provider } from './types';
import { PROVIDERS } from './types';

const RED = 'E0202E';
const GREY = '8A8A8A';
const TEXT = '111111';

function h(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2 | typeof HeadingLevel.HEADING_3 = HeadingLevel.HEADING_2) {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text, bold: true })],
  });
}

function p(text: string, opts: { bold?: boolean; color?: string } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, color: opts.color })],
  });
}

function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function cell(text: string, opts: { bold?: boolean; bg?: string } = {}) {
  return new TableCell({
    shading: opts.bg ? { fill: opts.bg, type: 'clear', color: 'auto' } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold })],
      }),
    ],
  });
}

function simpleTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h) => cell(h, { bold: true, bg: 'F2F2F2' })),
      }),
      ...rows.map(
        (r) => new TableRow({ children: r.map((c) => cell(c)) }),
      ),
    ],
  });
}

async function tryRenderChart(buildConfig: () => any): Promise<Buffer | null> {
  try {
    const mod: any = await import('chartjs-node-canvas');
    const ChartJSNodeCanvas = mod.ChartJSNodeCanvas || mod.default?.ChartJSNodeCanvas;
    if (!ChartJSNodeCanvas) return null;
    const canvas = new ChartJSNodeCanvas({
      width: 720,
      height: 360,
      backgroundColour: '#ffffff',
    });
    return await canvas.renderToBuffer(buildConfig());
  } catch {
    return null;
  }
}

async function loadHistoricalSov(): Promise<{ date: string; sov: number }[]> {
  try {
    const sb = getServerSupabase();
    const { data } = await sb
      .from('runs')
      .select('started_at, our_brand_sov')
      .eq('status', 'completed')
      .not('our_brand_sov', 'is', null)
      .order('started_at', { ascending: false })
      .limit(10);
    return (data ?? [])
      .reverse()
      .map((r: any) => ({
        date: new Date(r.started_at).toISOString().slice(0, 10),
        sov: Number(r.our_brand_sov ?? 0),
      }));
  } catch {
    return [];
  }
}

export async function buildDocxReport(summary: RunSummary, cfg: AgentConfig): Promise<Buffer> {
  const sections: any[] = [];

  // Cover
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'AGENT_04', bold: true, size: 56, color: RED }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'LLM Share of Voice & Ad Visibility', bold: true, size: 32 }),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: ' ' })] }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Brand: ', bold: true }),
        new TextRun({ text: cfg.our_brand || '—' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Category: ', bold: true }),
        new TextRun({ text: cfg.category || '—' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Run date: ', bold: true }),
        new TextRun({ text: new Date(summary.started_at).toLocaleString() }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Trigger: ', bold: true }),
        new TextRun({ text: 'scheduled' === summary.status ? 'scheduled' : 'see runs table' }),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: ' ' })] }),
  );

  // Executive summary
  const delta = summary.delta_sov;
  const deltaText =
    delta == null ? '—' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
  const takeaway =
    summary.overall_sov === 0
      ? `${cfg.our_brand || 'Our brand'} did not appear in any AI answer for the prompts tested this run.`
      : `${cfg.our_brand || 'Our brand'} held ${pct(summary.overall_sov)} share of voice across ${
          summary.total_mentions
        } brand mentions, with an average position of ${
          summary.our_avg_position == null ? '—' : `#${summary.our_avg_position.toFixed(1)}`
        }.`;

  sections.push(
    h('Executive summary', HeadingLevel.HEADING_1),
    p(takeaway),
    new Paragraph({
      children: [
        new TextRun({ text: 'Overall SoV: ', bold: true }),
        new TextRun({ text: pct(summary.overall_sov) }),
        new TextRun({ text: '   Δ vs last run: ', bold: true }),
        new TextRun({
          text: deltaText,
          color: delta == null ? GREY : delta >= 0 ? '3FB950' : RED,
        }),
      ],
    }),
    p(' '),
  );

  // Per-provider chart + table
  sections.push(h('Per-provider breakdown'));
  const providerChart = await tryRenderChart(() => ({
    type: 'bar',
    data: {
      labels: summary.per_provider.map((p) => p.provider),
      datasets: [
        {
          label: 'SoV %',
          data: summary.per_provider.map((p) => +(p.sov * 100).toFixed(1)),
          backgroundColor: '#E0202E',
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: 'SoV by provider (%)' } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  }));
  if (providerChart) {
    sections.push(
      new Paragraph({
        children: [
          new ImageRun({ data: providerChart, transformation: { width: 540, height: 270 } } as any),
        ],
      }),
    );
  }
  sections.push(
    simpleTable(
      ['Provider', 'SoV', 'Our mentions', 'Total mentions', 'Avg position'],
      summary.per_provider.map((p) => [
        p.provider,
        pct(p.sov),
        String(p.our_mentions),
        String(p.total_mentions),
        p.our_avg_position == null ? '—' : `#${p.our_avg_position.toFixed(1)}`,
      ]),
    ),
    p(' '),
  );

  // SoV over time
  sections.push(h('SoV over time'));
  const history = await loadHistoricalSov();
  if (history.length >= 2) {
    const trendChart = await tryRenderChart(() => ({
      type: 'line',
      data: {
        labels: history.map((h) => h.date),
        datasets: [
          {
            label: 'SoV %',
            data: history.map((h) => +(h.sov * 100).toFixed(1)),
            borderColor: '#E0202E',
            backgroundColor: 'rgba(224,32,46,0.15)',
            tension: 0.25,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false }, title: { display: true, text: 'SoV over last runs (%)' } },
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    }));
    if (trendChart) {
      sections.push(
        new Paragraph({
          children: [
            new ImageRun({ data: trendChart, transformation: { width: 540, height: 270 } } as any),
          ],
        }),
      );
    } else {
      sections.push(
        simpleTable(
          ['Date', 'SoV'],
          history.map((h) => [h.date, pct(h.sov)]),
        ),
      );
    }
  } else {
    sections.push(p('Not enough completed runs yet to chart a trend.', { color: GREY }));
  }
  sections.push(p(' '));

  // Per-prompt × provider
  sections.push(h('Per-prompt results'));
  const promptHeaders = ['Prompt', ...PROVIDERS] as string[];
  const promptRows = summary.prompt_results.map((pr) => [
    pr.prompt,
    ...PROVIDERS.map((p) =>
      pr.byProvider[p]?.appeared ? `#${pr.byProvider[p].position}` : '—',
    ),
  ]);
  sections.push(simpleTable(promptHeaders, promptRows), p(' '));

  // Competitors
  sections.push(h('Competitor landscape'));
  if (summary.competitors.length === 0) {
    sections.push(p('No competitor brands extracted.', { color: GREY }));
  } else {
    sections.push(
      simpleTable(
        ['Brand', 'Mentions', 'Avg position'],
        summary.competitors
          .slice(0, 15)
          .map((c) => [
            c.brand,
            String(c.mentions),
            c.avg_position == null ? '—' : `#${c.avg_position.toFixed(1)}`,
          ]),
      ),
    );
  }
  sections.push(p(' '));

  // Sentiment + snippets
  sections.push(h('Sentiment & language'));
  sections.push(
    simpleTable(
      ['Positive', 'Neutral', 'Negative'],
      [
        [
          String(summary.sentiment.positive),
          String(summary.sentiment.neutral),
          String(summary.sentiment.negative),
        ],
      ],
    ),
    p(' '),
  );
  if (summary.snippets.length > 0) {
    sections.push(p('Sample context snippets:', { bold: true }));
    for (const s of summary.snippets) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${s.provider} · ${s.sentiment}] `, bold: true, color: RED }),
            new TextRun({ text: `"${s.snippet}"`, italics: true }),
          ],
        }),
      );
    }
  }
  sections.push(p(' '));

  // Appendix
  sections.push(h('Appendix'));
  sections.push(p('Prompts run:', { bold: true }));
  for (const pr of summary.prompt_results) {
    sections.push(p(`• ${pr.prompt}`));
  }
  if (summary.errors.length > 0) {
    sections.push(p(' '), p('Provider errors:', { bold: true }));
    for (const e of summary.errors) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${e.provider}] `, bold: true, color: RED }),
            new TextRun({ text: `${e.prompt} — ${e.error}` }),
          ],
        }),
      );
    }
  }

  const doc = new Document({
    creator: 'Agent 4',
    title: 'LLM Share of Voice Report',
    sections: [{ children: sections }],
  });

  return await Packer.toBuffer(doc);
}

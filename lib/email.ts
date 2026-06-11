import { Resend } from 'resend';
import type { RunSummary } from './types';

export type SendReportArgs = {
  buffer: Buffer;
  filename: string;
  recipients: string[];
  subject: string;
  summary: RunSummary;
};

function html(summary: RunSummary): string {
  const delta = summary.delta_sov;
  const deltaText =
    delta == null
      ? '—'
      : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
  return `
  <div style="font-family: ui-monospace, Menlo, monospace; background:#0A0A0A; color:#FAFAFA; padding:24px;">
    <h2 style="color:#E0202E; letter-spacing:2px; margin:0 0 8px;">AGENT_04 // LLM SHARE OF VOICE</h2>
    <p style="color:#8A8A8A; margin:0 0 16px;">Brand: <strong style="color:#FAFAFA">${summary.our_brand || '—'}</strong></p>
    <div style="border:1px solid #2A2A2A; padding:16px; background:#151515;">
      <div>Overall SoV: <strong>${(summary.overall_sov * 100).toFixed(1)}%</strong></div>
      <div>Δ vs last run: <strong>${deltaText}</strong></div>
      <div>Avg position: <strong>${summary.our_avg_position == null ? '—' : '#' + summary.our_avg_position.toFixed(1)}</strong></div>
      <div>Total mentions: <strong>${summary.total_mentions}</strong></div>
    </div>
    <p style="color:#8A8A8A; margin-top:16px;">Full report attached as .docx.</p>
  </div>`;
}

export async function sendReport(args: SendReportArgs): Promise<void> {
  const { buffer, filename, recipients, subject, summary } = args;

  if (!recipients.length) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL;
  if (!key || !from) {
    throw new Error('RESEND_API_KEY or REPORT_FROM_EMAIL not set');
  }

  const resend = new Resend(key);
  await resend.emails.send({
    from,
    to: recipients,
    subject,
    html: html(summary),
    attachments: [
      {
        filename,
        content: buffer,
      },
    ],
  });
}

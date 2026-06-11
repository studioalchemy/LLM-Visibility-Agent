// Gmail API delivery using OAuth2 refresh token.
//
// One-time setup (see README §1 Email):
//   1. Google Cloud → new project → enable "Gmail API".
//   2. OAuth consent screen → External, add your Gmail as test user.
//   3. Credentials → OAuth 2.0 client → "Desktop" type → save client id + secret.
//   4. Use the OAuth Playground (https://developers.google.com/oauthplayground)
//      with your own credentials and scope `https://www.googleapis.com/auth/gmail.send`
//      to mint a refresh token. Copy it into env.
//
// Env required:
//   GOOGLE_GMAIL_CLIENT_ID
//   GOOGLE_GMAIL_CLIENT_SECRET
//   GOOGLE_GMAIL_REFRESH_TOKEN
//   REPORT_FROM_EMAIL              (the Gmail address that owns the refresh token)
import { google } from 'googleapis';
import type { RunSummary } from './types';

export type SendReportArgs = {
  buffer: Buffer;
  filename: string;
  recipients: string[];
  subject: string;
  summary: RunSummary;
};

function bodyHtml(summary: RunSummary): string {
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

// RFC 2822 / 5322 multipart message with an attachment. Returns the raw
// message ready to be base64url-encoded for gmail.users.messages.send.
function buildRawMessage(args: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  attachment: { filename: string; content: Buffer; mimeType: string };
}): string {
  const boundary = `agent4_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const safeSubject = `=?UTF-8?B?${Buffer.from(args.subject, 'utf8').toString('base64')}?=`;
  const attachmentB64 = args.attachment.content
    .toString('base64')
    // Gmail wants base64 lines wrapped (76 chars) for the legacy MIME case
    .replace(/(.{76})/g, '$1\r\n');

  const lines = [
    `From: ${args.from}`,
    `To: ${args.to.join(', ')}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    args.html,
    '',
    `--${boundary}`,
    `Content-Type: ${args.attachment.mimeType}; name="${args.attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${args.attachment.filename}"`,
    '',
    attachmentB64,
    '',
    `--${boundary}--`,
    '',
  ];
  return lines.join('\r\n');
}

function toBase64Url(s: string): string {
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_GMAIL_CLIENT_ID &&
      process.env.GOOGLE_GMAIL_CLIENT_SECRET &&
      process.env.GOOGLE_GMAIL_REFRESH_TOKEN &&
      process.env.REPORT_FROM_EMAIL,
  );
}

export async function sendReport(args: SendReportArgs): Promise<void> {
  const { buffer, filename, recipients, subject, summary } = args;
  if (!recipients.length) return;

  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_GMAIL_REFRESH_TOKEN;
  const from = process.env.REPORT_FROM_EMAIL;

  if (!clientId || !clientSecret || !refreshToken || !from) {
    throw new Error(
      'Gmail not configured: need GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GOOGLE_GMAIL_REFRESH_TOKEN, REPORT_FROM_EMAIL',
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  const raw = buildRawMessage({
    from,
    to: recipients,
    subject,
    html: bodyHtml(summary),
    attachment: {
      filename,
      content: buffer,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: toBase64Url(raw) },
  });
}

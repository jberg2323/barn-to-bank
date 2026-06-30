const nodemailer = require('nodemailer');

const TYPE_LABELS = {
  feature: 'New feature',
  customization: 'Customization',
  data: 'Data source / county',
  ui: 'UI / layout',
  bug: 'Bug report',
  other: 'Other',
};

const PRIORITY_LABELS = {
  nice: 'Nice to have',
  important: 'Important',
  blocking: 'Blocking / urgent',
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailContent(req) {
  const type = TYPE_LABELS[req.type] || req.type;
  const priority = PRIORITY_LABELS[req.priority] || req.priority;
  const submitter = req.name?.trim() || 'Anonymous';
  const email = req.email?.trim() || '';
  const context = req.context?.trim() || 'Barn to Bank: general';
  const description = req.description?.trim() || '(No description provided)';
  const attachCount = Array.isArray(req.attachments) ? req.attachments.length : 0;
  const attachNames = attachCount
    ? req.attachments.map((a) => a.name).filter(Boolean).join(', ')
    : '';
  const appUrl = process.env.FEATURE_REQUEST_APP_URL || 'https://barntobank.com/app';

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 640px; line-height: 1.5; color: #1c241d;">
      <h2 style="margin: 0 0 8px; color: #142a1f;">New Barn to Bank feature request</h2>
      <p style="margin: 0 0 20px; color: #6d7568;">Submitted from the staff origination app.</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 8px 0; color: #6d7568; width: 120px;">Title</td><td style="padding: 8px 0;"><strong>${escapeHtml(req.title)}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6d7568;">Type</td><td style="padding: 8px 0;">${escapeHtml(type)}</td></tr>
        <tr><td style="padding: 8px 0; color: #6d7568;">Priority</td><td style="padding: 8px 0;">${escapeHtml(priority)}</td></tr>
        <tr><td style="padding: 8px 0; color: #6d7568;">Submitted by</td><td style="padding: 8px 0;">${escapeHtml(submitter)}${email ? ` (${escapeHtml(email)})` : ''}</td></tr>
        <tr><td style="padding: 8px 0; color: #6d7568;">Context</td><td style="padding: 8px 0;">${escapeHtml(context)}</td></tr>
        ${attachCount ? `<tr><td style="padding: 8px 0; color: #6d7568;">Attachments</td><td style="padding: 8px 0;">${attachCount} file(s): ${escapeHtml(attachNames)} (view in app queue)</td></tr>` : ''}
      </table>
      <div style="border-left: 3px solid #9a6f22; padding: 12px 16px; background: #f4eddf; white-space: pre-wrap; margin-bottom: 24px;">${escapeHtml(description)}</div>
      <p>
        <a href="${escapeHtml(appUrl)}" style="display: inline-block; padding: 10px 16px; background: #142a1f; color: #f4eddf; text-decoration: none; border-radius: 8px;">Open Barn to Bank</a>
      </p>
      <p style="color: #6d7568; font-size: 12px; margin-top: 24px;">Request ID: ${escapeHtml(req.id)} · ${escapeHtml(req.submittedAt || new Date().toISOString())}</p>
    </div>
  `;

  const text = [
    `New Barn to Bank feature request: ${req.title}`,
    '',
    `Type: ${type}`,
    `Priority: ${priority}`,
    `Submitted by: ${submitter}${email ? ` (${email})` : ''}`,
    `Context: ${context}`,
    attachCount ? `Attachments: ${attachCount} (${attachNames})` : '',
    '',
    description,
    '',
    `Open app: ${appUrl}`,
    `Request ID: ${req.id}`,
  ].join('\n');

  return { type, html, text };
}

function notifyRecipients() {
  const raw = process.env.FEATURE_REQUEST_NOTIFY_EMAIL || 'jeremy@cto.com,jeremy@mission.org';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function gmailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

async function sendViaResend(req, { type, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const to = notifyRecipients();
  const from = process.env.FEATURE_REQUEST_FROM_EMAIL || 'Barn to Bank <intake@cto.com>';
  const subject = `Barn to Bank: [${type}] ${req.title}`;
  const replyTo = req.email?.trim() || undefined;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Resend ${res.status}`);
  }
  return { ok: true, id: data?.id, provider: 'resend' };
}

async function sendViaGmail(req, { type, html, text }) {
  const transporter = gmailTransporter();
  if (!transporter) return null;

  const to = notifyRecipients();
  const from = process.env.FEATURE_REQUEST_FROM_EMAIL || `Barn to Bank <${process.env.GMAIL_USER}>`;
  const subject = `Barn to Bank: [${type}] ${req.title}`;
  const submitterEmail = req.email?.trim() || '';
  const replyTo = submitterEmail && submitterEmail !== process.env.GMAIL_USER
    ? submitterEmail
    : undefined;

  const result = await transporter.sendMail({
    from,
    to,
    replyTo,
    subject,
    html,
    text,
    headers: {
      'X-Entity-Ref-ID': req.id,
    },
  });

  return { ok: true, id: result.messageId, provider: 'gmail', to };
}

async function sendFeatureRequestEmail(req) {
  const content = buildEmailContent(req);

  if (process.env.RESEND_API_KEY) {
    try {
      const resendResult = await sendViaResend(req, content);
      if (resendResult?.ok) return resendResult;
    } catch (err) {
      console.warn('[feature-request-email] Resend failed, trying Gmail:', err.message || err);
    }
  }

  try {
    const gmailResult = await sendViaGmail(req, content);
    if (gmailResult?.ok) return gmailResult;
  } catch (err) {
    console.error('[feature-request-email] Gmail send failed', { id: req.id, error: err.message || err });
    return { ok: false, error: err.message || String(err) };
  }

  console.warn('[feature-request-email] No email provider configured', { id: req.id });
  return { ok: false, error: 'Email not configured (set RESEND_API_KEY or GMAIL_USER + GMAIL_APP_PASSWORD)' };
}

module.exports = { sendFeatureRequestEmail };
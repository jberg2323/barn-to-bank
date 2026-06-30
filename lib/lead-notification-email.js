const nodemailer = require('nodemailer');

const INTENT_LABELS = {
  sell: 'Ready to sell',
  valuation: 'Request a valuation',
  inquiry: 'General inquiry',
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function notifyRecipients() {
  const raw = process.env.LEAD_NOTIFY_EMAIL
    || process.env.FEATURE_REQUEST_NOTIFY_EMAIL
    || 'jackzitlow@kw.com,jeremy@cto.com';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function fromAddress() {
  return process.env.LEAD_FROM_EMAIL
    || process.env.FEATURE_REQUEST_FROM_EMAIL
    || 'Barn to Bank <intake@cto.com>';
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

function buildEmailContent(lead) {
  const intent = INTENT_LABELS[lead.intent] || lead.intent || 'Website inquiry';
  const appUrl = process.env.LEAD_APP_URL || 'https://barntobank.com/app';
  const phone = lead.phone?.trim() || '';
  const county = lead.county?.trim() || '';
  const acreage = lead.acreage?.trim() || '';
  const listing = lead.listing?.trim() || '';
  const about = lead.about?.trim() || '(No details provided)';

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 640px; line-height: 1.5; color: #1c241d;">
      <h2 style="margin: 0 0 8px; color: #142a1f;">New landowner inquiry</h2>
      <p style="margin: 0 0 20px; color: #6d7568;">Submitted from the public contact form at barntobank.com.</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 8px 0; color: #6d7568; width: 120px;">Name</td><td style="padding: 8px 0;"><strong>${escapeHtml(lead.name)}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6d7568;">Email</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
        ${phone ? `<tr><td style="padding: 8px 0; color: #6d7568;">Phone</td><td style="padding: 8px 0;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>` : ''}
        <tr><td style="padding: 8px 0; color: #6d7568;">Intent</td><td style="padding: 8px 0;">${escapeHtml(intent)}</td></tr>
        ${county ? `<tr><td style="padding: 8px 0; color: #6d7568;">County</td><td style="padding: 8px 0;">${escapeHtml(county)}</td></tr>` : ''}
        ${acreage ? `<tr><td style="padding: 8px 0; color: #6d7568;">Acreage</td><td style="padding: 8px 0;">${escapeHtml(acreage)}</td></tr>` : ''}
        ${listing ? `<tr><td style="padding: 8px 0; color: #6d7568;">Listing</td><td style="padding: 8px 0;">${escapeHtml(listing)}</td></tr>` : ''}
      </table>
      <div style="border-left: 3px solid #9a6f22; padding: 12px 16px; background: #f4eddf; white-space: pre-wrap; margin-bottom: 24px;">${escapeHtml(about)}</div>
      <p>
        <a href="${escapeHtml(appUrl)}" style="display: inline-block; padding: 10px 16px; background: #142a1f; color: #f4eddf; text-decoration: none; border-radius: 8px;">Open Website Leads in Barn to Bank</a>
      </p>
      <p style="color: #6d7568; font-size: 12px; margin-top: 24px;">Lead ID: ${escapeHtml(lead.id)} · ${escapeHtml(lead.createdAt || new Date().toISOString())}</p>
    </div>
  `;

  const text = [
    `New landowner inquiry: ${lead.name}`,
    '',
    `Email: ${lead.email}`,
    phone ? `Phone: ${phone}` : '',
    `Intent: ${intent}`,
    county ? `County: ${county}` : '',
    acreage ? `Acreage: ${acreage}` : '',
    listing ? `Listing: ${listing}` : '',
    '',
    about,
    '',
    `Open app: ${appUrl}`,
    `Lead ID: ${lead.id}`,
  ].filter(Boolean).join('\n');

  return { intent, html, text };
}

async function sendViaResend(lead, content) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: notifyRecipients(),
      subject: `Barn to Bank: New inquiry — ${lead.name}${lead.county ? ` (${lead.county} Co.)` : ''}`,
      html: content.html,
      text: content.text,
      ...(lead.email?.trim() ? { reply_to: lead.email.trim() } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Resend ${res.status}`);
  }
  return { ok: true, id: data?.id, provider: 'resend' };
}

async function sendViaGmail(lead, content) {
  const transporter = gmailTransporter();
  if (!transporter) return null;

  const result = await transporter.sendMail({
    from: fromAddress(),
    to: notifyRecipients(),
    replyTo: lead.email?.trim() || undefined,
    subject: `Barn to Bank: New inquiry — ${lead.name}${lead.county ? ` (${lead.county} Co.)` : ''}`,
    html: content.html,
    text: content.text,
    headers: { 'X-Entity-Ref-ID': lead.id },
  });

  return { ok: true, id: result.messageId, provider: 'gmail' };
}

async function sendLeadNotificationEmail(lead) {
  const content = buildEmailContent(lead);

  if (process.env.RESEND_API_KEY) {
    try {
      const resendResult = await sendViaResend(lead, content);
      if (resendResult?.ok) return resendResult;
    } catch (err) {
      console.warn('[lead-notification-email] Resend failed, trying Gmail:', err.message || err);
    }
  }

  try {
    const gmailResult = await sendViaGmail(lead, content);
    if (gmailResult?.ok) return gmailResult;
  } catch (err) {
    console.error('[lead-notification-email] Gmail send failed', { id: lead.id, error: err.message || err });
    return { ok: false, error: err.message || String(err) };
  }

  console.warn('[lead-notification-email] No email provider configured', { id: lead.id });
  return { ok: false, error: 'Email not configured' };
}

module.exports = { sendLeadNotificationEmail };
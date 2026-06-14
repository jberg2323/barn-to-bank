const DNC_SCRUB_URL = 'https://www.dncscrub.com/app/main/rpc/scrub';
const PROVIDER = 'DNCScrub (Contact Center Compliance)';
const { scrubPhonesViaMcp, mcpRowToRaw } = require('./dnc-scrub-mcp');

/** Result codes safe to queue for cold SMS/voice after federal + state DNC scrub. */
const CLEARED_CODES = new Set(['C', 'E', 'O', 'X']);

/** Always block, on a DNC list, invalid, or restricted. */
const BLOCKED_CODES = new Set(['D', 'P', 'B', 'I', 'M', 'L', 'V', 'F']);

function apiKey() {
  return process.env.DNC_SCRUB_API_KEY || process.env.DNC_REGISTRY_API_KEY || '';
}

function useMock() {
  return process.env.DNC_SCRUB_MOCK === 'true' || process.env.DNC_SCRUB_MOCK === '1';
}

function useMcp() {
  return process.env.DNC_SCRUB_USE_MCP !== 'false' && process.env.DNC_SCRUB_USE_MCP !== '0';
}

function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

function formatDisplayPhone(digits) {
  if (!digits || digits.length !== 10) return String(digits || '');
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
}

function buildLabel(status, resultCode, reason, scrubbedAt) {
  const ts = formatTimestamp(scrubbedAt);
  if (status === 'blocked') {
    if (resultCode === 'D' && /litigator/i.test(reason || '')) {
      return 'TCPA Litigator, DO NOT CONTACT';
    }
    if (resultCode === 'D' || resultCode === 'P') {
      return 'DNC, DO NOT CONTACT';
    }
    if (resultCode === 'W' || resultCode === 'Y') {
      return 'Wireless/VoIP, TCPA consent required';
    }
    if (resultCode === 'L' || resultCode === 'V' || resultCode === 'F') {
      return 'Wireless restricted, DO NOT CONTACT';
    }
    if (resultCode === 'B') return 'Blocked area code, DO NOT CONTACT';
    if (resultCode === 'I' || resultCode === 'M') return 'Invalid number, DO NOT CONTACT';
    return reason ? `${reason}, DO NOT CONTACT` : 'DO NOT CONTACT';
  }
  return `Federal DNC Registry scrub, cleared [${ts}]`;
}

function mapScrubResult(raw, originalInput, scrubbedAt) {
  const phone = raw?.Phone || normalizePhone(originalInput) || String(originalInput || '');
  const resultCode = String(raw?.ResultCode || 'M').toUpperCase();
  const reason = String(raw?.Reason || '').trim();

  let status = 'blocked';
  if (CLEARED_CODES.has(resultCode)) {
    status = 'cleared';
  } else if (BLOCKED_CODES.has(resultCode)) {
    status = 'blocked';
  } else if (resultCode === 'W' || resultCode === 'Y' || resultCode === 'G' || resultCode === 'H') {
    // Wireless/VoIP without a landline-safe exemption, block cold texts.
    status = 'blocked';
  }

  return {
    number: originalInput || formatDisplayPhone(phone),
    phone,
    status,
    resultCode,
    reason,
    scrubbedAt,
    label: buildLabel(status, resultCode, reason, scrubbedAt),
    provider: PROVIDER,
    lineType: raw?.LineType || null,
    isWirelessOrVoIP: raw?.IsWirelessOrVoIP === '1',
    region: raw?.RegionAbbrev || null,
    locale: raw?.Locale || null,
  };
}

async function mockScrubPhones(phones) {
  await new Promise((r) => setTimeout(r, 400 + phones.length * 80));
  const scrubbedAt = new Date().toISOString();
  return phones.map((input) => {
    const phone = normalizePhone(input);
    const blocked = !phone
      || phone.endsWith('0199')
      || phone.endsWith('9999')
      || phone.startsWith('555');
    const raw = blocked
      ? { Phone: phone || '0000000000', ResultCode: 'D', Reason: 'National (USA) 2003-06-01;;;' }
      : { Phone: phone, ResultCode: 'C', Reason: '', LineType: 'AllOther', IsWirelessOrVoIP: '0' };
    return mapScrubResult(raw, input, scrubbedAt);
  });
}

function normalizePhoneInputs(phones) {
  const normalized = phones.map((p) => ({ input: p, digits: normalizePhone(p) }));
  const invalid = normalized.filter((n) => !n.digits);
  if (invalid.length) {
    const err = new Error(`Invalid phone number(s): ${invalid.map((n) => n.input).join(', ')}`);
    err.code = 'INVALID_PHONE';
    throw err;
  }
  return normalized;
}

async function liveScrubPhonesRest(normalized) {
  const key = apiKey();
  const phoneList = normalized.map((n) => n.digits).join(',');
  const body = {
    phoneList,
    version: '5',
    output: 'json',
  };
  if (process.env.DNC_SCRUB_PROJECT_ID) body.projId = process.env.DNC_SCRUB_PROJECT_ID;
  if (process.env.DNC_SCRUB_CAMPAIGN_ID) body.campaignId = process.env.DNC_SCRUB_CAMPAIGN_ID;

  const res = await fetch(DNC_SCRUB_URL, {
    method: 'POST',
    headers: {
      loginId: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    const err = new Error(`DNCScrub REST error (${res.status}): ${text.slice(0, 240)}`);
    err.code = 'UPSTREAM_ERROR';
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`DNCScrub REST error (${res.status}): ${text.slice(0, 240)}`);
    err.code = 'UPSTREAM_ERROR';
    throw err;
  }

  const rows = Array.isArray(payload) ? payload : payload?.results || payload?.data;
  if (!Array.isArray(rows)) {
    const err = new Error('DNCScrub REST returned an unexpected response format');
    err.code = 'UPSTREAM_ERROR';
    throw err;
  }

  const byPhone = new Map(rows.map((row) => [String(row.Phone), row]));
  const scrubbedAt = new Date().toISOString();

  return normalized.map(({ input, digits }) => {
    const raw = byPhone.get(digits) || { Phone: digits, ResultCode: 'M', Reason: 'Malformed' };
    return mapScrubResult(raw, input, scrubbedAt);
  });
}

async function liveScrubPhonesMcp(normalized) {
  const digitsList = normalized.map((n) => n.digits);
  const rows = await scrubPhonesViaMcp(digitsList);
  const byPhone = new Map(rows.map((row) => [String(row.phone), row]));
  const scrubbedAt = new Date().toISOString();

  return normalized.map(({ input, digits }) => {
    const mcpRow = byPhone.get(digits);
    const raw = mcpRow ? mcpRowToRaw(mcpRow) : { Phone: digits, ResultCode: 'M', Reason: 'Malformed' };
    return mapScrubResult(raw, input, scrubbedAt);
  });
}

async function liveScrubPhones(phones) {
  const key = apiKey();
  if (!key) {
    const err = new Error(
      'DNC scrub not configured. Run: npm run provision-dncscrub-mcp (or set DNC_SCRUB_API_KEY in Vercel).',
    );
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const normalized = normalizePhoneInputs(phones);

  if (useMcp()) {
    try {
      const results = await liveScrubPhonesMcp(normalized);
      results.forEach((r) => { r.transport = 'mcp'; });
      return results;
    } catch (err) {
      if (err.code === 'NOT_CONFIGURED') throw err;
      console.warn('DNCScrub MCP unavailable, falling back to REST:', err.message);
    }
  }

  const results = await liveScrubPhonesRest(normalized);
  results.forEach((r) => { r.transport = 'rest'; });
  return results;
}

async function scrubPhones(phones) {
  const list = Array.isArray(phones) ? phones.filter(Boolean) : [];
  if (!list.length) return [];

  if (useMock()) {
    const results = await mockScrubPhones(list);
    return { results, live: false, provider: `${PROVIDER} (mock)` };
  }

  const results = await liveScrubPhones(list);
  const transport = results[0]?.transport === 'mcp' ? 'mcp' : 'rest';
  return { results, live: true, provider: PROVIDER, transport };
}

module.exports = {
  PROVIDER,
  normalizePhone,
  scrubPhones,
  mapScrubResult,
};
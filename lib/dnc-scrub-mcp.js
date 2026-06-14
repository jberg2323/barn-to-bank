const MCP_URL = process.env.DNC_SCRUB_MCP_URL || 'https://mcp.dnc.com/mcp';

function apiKey() {
  return process.env.DNC_SCRUB_API_KEY || process.env.DNC_REGISTRY_API_KEY || '';
}

function parseSsePayload(text) {
  const lines = text.split('\n');
  const dataLines = lines.filter((l) => l.startsWith('data:'));
  if (!dataLines.length) return null;
  const last = dataLines[dataLines.length - 1].replace(/^data:\s*/, '');
  if (!last || last === '[DONE]') return null;
  return JSON.parse(last);
}

function parseMcpResponse(text, contentType = '') {
  if (!text) return null;
  if (contentType.includes('text/event-stream') || text.includes('data:')) {
    return parseSsePayload(text);
  }
  try {
    return JSON.parse(text);
  } catch {
    return parseSsePayload(text);
  }
}

async function mcpRequest(body, sessionId) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'x-dncscrub-api-key': apiKey(),
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const payload = parseMcpResponse(text, res.headers.get('content-type') || '');
  return {
    ok: res.ok,
    status: res.status,
    sessionId: res.headers.get('mcp-session-id') || sessionId || null,
    payload,
    raw: text.slice(0, 500),
  };
}

async function initializeSession() {
  const init = await mcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'barn-to-bank', version: '1.0.0' },
    },
  });

  if (!init.payload) {
    const err = new Error(`DNCScrub MCP initialize failed (${init.status})`);
    err.code = 'MCP_UNAVAILABLE';
    throw err;
  }

  const sessionId = init.sessionId;
  await mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);
  return sessionId;
}

function extractToolResult(payload) {
  if (!payload) return null;
  if (payload.error) {
    const err = new Error(payload.error.message || 'DNCScrub MCP tool error');
    err.code = 'MCP_TOOL_ERROR';
    throw err;
  }
  const result = payload.result;
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  if (Array.isArray(result.content)) {
    const textPart = result.content.find((p) => p.type === 'text');
    if (textPart?.text) {
      try {
        return JSON.parse(textPart.text);
      } catch {
        return null;
      }
    }
  }
  return result;
}

async function scrubPhonesViaMcp(digitsList) {
  const key = apiKey();
  if (!key) {
    const err = new Error('DNC_SCRUB_API_KEY not configured for MCP scrub');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const sessionId = await initializeSession();
  const args = { phoneNumbers: digitsList };
  if (process.env.DNC_SCRUB_PROJECT_ID) args.projId = process.env.DNC_SCRUB_PROJECT_ID;
  if (process.env.DNC_SCRUB_CAMPAIGN_ID) args.campaignId = Number(process.env.DNC_SCRUB_CAMPAIGN_ID) || process.env.DNC_SCRUB_CAMPAIGN_ID;

  const call = await mcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'scrub_phone_numbers',
      arguments: args,
    },
  }, sessionId);

  const toolPayload = extractToolResult(call.payload);
  if (!toolPayload) {
    const err = new Error(`DNCScrub MCP scrub failed (${call.status}): ${call.raw}`);
    err.code = 'MCP_UNAVAILABLE';
    throw err;
  }

  if (toolPayload.success === false) {
    const err = new Error(toolPayload.errorMessage || 'DNCScrub MCP scrub failed');
    err.code = 'UPSTREAM_ERROR';
    throw err;
  }

  return toolPayload.results || [];
}

function mcpRowToRaw(row) {
  return {
    Phone: row.phone,
    ResultCode: row.resultCode,
    Reason: row.reason || '',
    LineType: row.lineType || null,
    IsWirelessOrVoIP: row.isWireless ? '1' : '0',
    RegionAbbrev: row.region || null,
    Locale: row.locale || null,
  };
}

module.exports = {
  MCP_URL,
  scrubPhonesViaMcp,
  mcpRowToRaw,
};
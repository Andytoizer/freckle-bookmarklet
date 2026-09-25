// Freckle API client. Same endpoints and token as the Freckle CLI and the Rep MCP:
// device sign-in at /v2/cli-device-auth, then the token in X-Api-Key plus an x-org-id header.

export const API_BASE = 'https://next-api.freckle.io';
export const APP_BASE = 'https://next.freckle.io';

export class FreckleError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { token, orgId, method = 'GET', query, body } = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = { accept: 'application/json' };
  // CLI tokens go in X-Api-Key. Freckle rejects them as Bearer tokens ("Missing API key").
  if (token) headers['x-api-key'] = token;
  if (orgId) headers['x-org-id'] = orgId;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new FreckleError("Couldn't reach Freckle. Check your connection.", 0);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && (data.message || data._tag)) || `Freckle returned HTTP ${res.status}`;
    throw new FreckleError(String(msg), res.status, data);
  }
  return data;
}

// ── Sign-in (device flow, same as `freckle login`) ─────────────────────────

export async function startDeviceAuth() {
  const date = new Date().toISOString().slice(0, 10);
  const session = await request('/v2/cli-device-auth', {
    method: 'POST',
    body: { name: `Send to Freckle extension · ${date}` },
  });
  return { ...session, approveUrl: `${APP_BASE}/cli-auth?code=${encodeURIComponent(session.userCode)}` };
}

export async function claimDeviceAuth(deviceCode) {
  return request('/v2/cli-device-auth/claim', { method: 'POST', body: { deviceCode } });
}

// Polls until the person approves in the browser. `signal` cancels it.
export async function waitForApproval(session, signal) {
  const interval = Math.max(1, session.intervalSeconds) * 1000;
  const deadline = Date.now() + session.expiresInSeconds * 1000;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new FreckleError('Sign-in cancelled.', 0);
    let claim;
    try { claim = await claimDeviceAuth(session.deviceCode); } catch { claim = { status: 'pending' }; }
    if (claim.status === 'approved') return claim.tokenValue;
    if (claim.status === 'expired') throw new FreckleError('That sign-in request expired. Start again.', 0);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new FreckleError('Timed out waiting for approval. Start again.', 0);
}

export async function whoami(token) {
  return request('/v2/whoami', { token }); // { userId, email?, name? }
}

export async function listOrganizations(token) {
  const data = await request('/v2/cli/organizations', { token });
  return data.organizations || [];
}

// ── Workflows and runs ─────────────────────────────────────────────────────

// Active workflows with their input/output shape, cost estimate, owner and metadata.
export async function listWorkflows(token, orgId) {
  const all = [];
  let cursor;
  for (let page = 0; page < 20; page++) {
    const data = await request('/v2/workflows', { token, orgId, query: { limit: 100, cursor } });
    all.push(...(data.workflows || []));
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return all.filter((w) => !w.archivedAt);
}

export async function getWorkflow(token, orgId, workflowId) {
  return (await request(`/v2/workflows/${workflowId}`, { token, orgId })).workflow;
}

// Freckle replaces the whole metadata object on update, so pass the merged object.
export async function updateWorkflowMetadata(token, orgId, workflowId, metadata) {
  return (await request(`/v2/workflows/${workflowId}`, { token, orgId, method: 'PATCH', body: { metadata } })).workflow;
}

// Returns { type: 'accepted', runId, … } or { type: 'rejected', errors }.
export async function startRun(token, orgId, workflowId, inputs, metadata) {
  return request(`/v2/workflows/${workflowId}/runs`, {
    token, orgId, method: 'POST', body: { inputs, ...(metadata ? { metadata } : {}) },
  });
}

// { status: accepted|running|waiting|completed|failed|cancelled, outputs?, error?, creditsConsumed }
export async function getRunData(token, orgId, runId) {
  return request(`/v2/workflow-runs/${runId}/data`, { token, orgId });
}

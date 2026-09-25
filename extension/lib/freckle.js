// Freckle API client. Uses the same endpoints and token the Freckle CLI uses:
// device sign-in at /v2/cli-device-auth, then a Bearer token plus an x-org-id header.

export const API_BASE = 'https://next-api.freckle.io';
export const APP_BASE = 'https://next.freckle.io';

// The shared workflow list lives in each org as an ordinary Freckle dataset,
// so workflow creators can edit it here or in Freckle's own table view.
export const REGISTRY_WORKBOOK = 'Send to Freckle';
export const REGISTRY_DATASET = 'Extension workflows';

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
  if (token) headers.authorization = `Bearer ${token}`;
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

// ── Orgs, workbooks, datasets ──────────────────────────────────────────────

export async function listOrganizations(token) {
  const data = await request('/v2/cli/organizations', { token });
  return data.organizations || [];
}

export async function listWorkbooks(token, orgId) {
  const all = [];
  let cursor;
  for (let page = 0; page < 20; page++) {
    const data = await request('/v2/workbooks', { token, orgId, query: { limit: 100, cursor } });
    all.push(...(data.workbooks || []));
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return all.filter((w) => !w.archivedAt);
}

export async function createWorkbook(token, orgId, label, description) {
  const data = await request('/v2/workbooks', { token, orgId, method: 'POST', body: { label, description } });
  return data.workbook;
}

export async function createDataset(token, orgId, workbookId, label, description) {
  const data = await request(`/v2/workbooks/${workbookId}/datasets`, {
    token, orgId, method: 'POST', body: { label, description },
  });
  return data.dataset;
}

export async function listEntries(token, orgId, workbookId, datasetId) {
  const all = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    const data = await request(`/v2/datasets/${datasetId}/entries`, {
      token, orgId, query: { workbookId, limit: 1000, cursor },
    });
    all.push(...(data.entries || []));
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return all.filter((e) => !e.deletionRequestedAt);
}

export async function createEntry(token, orgId, workbookId, datasetId, value) {
  const data = await request(`/v2/datasets/${datasetId}/entries`, {
    token, orgId, method: 'POST', query: { workbookId }, body: { value },
  });
  return data.entry;
}

export async function updateEntry(token, orgId, workbookId, datasetId, entryId, value) {
  const data = await request(`/v2/datasets/${datasetId}/entries/${entryId}`, {
    token, orgId, method: 'PATCH', query: { workbookId }, body: { value },
  });
  return data.entry;
}

export async function deleteEntries(token, orgId, workbookId, datasetId, entryIds) {
  return request(`/v2/datasets/${datasetId}/entries/delete`, {
    token, orgId, method: 'POST', query: { workbookId }, body: { entryIds },
  });
}

// ── The shared workflow list ───────────────────────────────────────────────

export function findRegistry(workbooks) {
  const wb = workbooks.find((w) => w.label === REGISTRY_WORKBOOK);
  if (!wb) return null;
  const ds = (wb.datasets || []).find((d) => d.label === REGISTRY_DATASET && !d.archivedAt);
  return ds ? { workbookId: wb.id, datasetId: ds.id, url: wb.url } : { workbookId: wb.id, datasetId: null, url: wb.url };
}

export async function ensureRegistry(token, orgId, workbooks) {
  const found = findRegistry(workbooks);
  if (found?.datasetId) return found;
  const workbookId = found?.workbookId
    || (await createWorkbook(token, orgId, REGISTRY_WORKBOOK,
      'Workflows the Send to Freckle Chrome extension can send pages to. One row per workflow.')).id;
  const ds = await createDataset(token, orgId, workbookId, REGISTRY_DATASET,
    'name, workbookId, datasetId, field (JSON pointer), pageTypes (comma separated; blank = any page).');
  return { workbookId, datasetId: ds.id, url: null };
}

// Turns registry rows into send targets. Rows that don't point at a live dataset are marked broken.
export function toTargets(entries, workbooks) {
  const byDataset = new Map();
  for (const w of workbooks) for (const d of w.datasets || []) byDataset.set(d.id, { workbook: w, dataset: d });
  return entries.map((e) => {
    const v = e.value || {};
    const hit = byDataset.get(v.datasetId);
    const conn = hit ? (hit.workbook.connections || []).find((c) => c.inputDatasetId === v.datasetId) : null;
    return {
      id: e.id,
      name: String(v.name || 'Untitled workflow'),
      workbookId: v.workbookId,
      datasetId: v.datasetId,
      field: normalizePointer(v.field || '/url'),
      pageTypes: parsePageTypes(v.pageTypes),
      workbookLabel: hit?.workbook.label || null,
      datasetLabel: hit?.dataset.label || null,
      workbookUrl: hit?.workbook.url || null,
      trigger: conn ? conn.triggerPolicy : null,
      broken: !hit || !!hit.dataset.archivedAt,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function parsePageTypes(v) {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function normalizePointer(p) {
  const s = String(p).trim();
  return s.startsWith('/') ? s : '/' + s;
}

// Builds the row value for a JSON pointer like /linkedin_url or /person/profile_url.
export function valueForPointer(pointer, url) {
  const parts = normalizePointer(pointer).slice(1).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  const root = {};
  let node = root;
  parts.forEach((key, i) => {
    if (i === parts.length - 1) node[key] = url;
    else node = node[key] = {};
  });
  return root;
}

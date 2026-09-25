// State, running plays, and publishing. Shared by the side panel and the keyboard shortcut.
import * as freckle from './freckle.js';
import { classify, normalize, isSalesNavLead, extractSalesNavProfile, withArticle } from './pages.js';
import { toPlay, ownedWorkflows, inputsFor, mergedMetadata, playSettings, takesUrl } from './plays.js';

const local = chrome.storage.local;
const FINAL = new Set(['completed', 'failed', 'cancelled']);

export async function getAuth() {
  return (await local.get('auth')).auth || null;
}
export async function setAuth(auth) {
  await local.set({ auth });
}
export async function signOut() {
  await local.remove(['auth']);
}

export async function getCache(orgId) {
  return (await local.get(`cache:${orgId}`))[`cache:${orgId}`] || null;
}

// Loads the org's published plays, plus the workflows this person owns (for publishing).
// Cached so the keyboard shortcut works without the panel open.
export async function refresh(auth) {
  if (!auth.me) {
    auth.me = await freckle.whoami(auth.token);
    await setAuth(auth);
  }
  const workflows = await freckle.listWorkflows(auth.token, auth.orgId);
  const plays = workflows.map(toPlay).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const mine = ownedWorkflows(workflows, auth.me.userId);
  const cache = { plays, mine, fetchedAt: Date.now() };
  await local.set({ [`cache:${auth.orgId}`]: cache });
  return cache;
}

// Per person: plays they've hidden from their own dropdown.
export async function getHidden(orgId) {
  return (await local.get(`hidden:${orgId}`))[`hidden:${orgId}`] || [];
}
export async function setHidden(orgId, id, hide) {
  const h = new Set(await getHidden(orgId));
  if (hide) h.add(id); else h.delete(id);
  await local.set({ [`hidden:${orgId}`]: [...h] });
}

export function playsFor(plays, pageType, hidden = []) {
  return plays.filter((p) => !hidden.includes(p.id) && (p.pages.length === 0 || p.pages.includes(pageType)));
}

export async function getDefaults(orgId) {
  return (await local.get(`defaults:${orgId}`))[`defaults:${orgId}`] || {};
}
export async function setDefault(orgId, pageType, playId) {
  const d = await getDefaults(orgId);
  d[pageType] = playId;
  await local.set({ [`defaults:${orgId}`]: d });
}

export function pickDefault(applicable, defaults, pageType) {
  return applicable.find((p) => p.id === defaults[pageType]) || applicable[0] || null;
}

// ── Recent runs ────────────────────────────────────────────────────────────

export async function getHistory() {
  return (await local.get('history')).history || [];
}
async function pushHistory(item) {
  const h = await getHistory();
  h.unshift(item);
  await local.set({ history: h.slice(0, 25) });
}
async function patchHistory(id, patch) {
  const h = await getHistory();
  const i = h.findIndex((x) => x.id === id);
  if (i < 0) return;
  h[i] = { ...h[i], ...patch };
  await local.set({ history: h });
}

// ── The page ───────────────────────────────────────────────────────────────

// Works out the URL to send for a tab. Only Sales Navigator leads need to read the page.
export async function resolvePage(tab) {
  const pageType = classify(tab.url || '');
  if (!pageType) return { error: "This page can't be sent. Open a website, LinkedIn, HubSpot or Salesforce page." };
  const title = tab.title || '';
  if (!isSalesNavLead(tab.url)) return { pageType, url: normalize(tab.url), title };
  let result;
  try {
    [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractSalesNavProfile });
  } catch {
    return { pageType, error: 'Allow access to LinkedIn to send Sales Navigator leads.', needsLinkedIn: true };
  }
  if (!result?.url) return { pageType, error: "Couldn't find this lead's LinkedIn profile link. Wait for the page to finish loading and try again." };
  return { pageType, url: normalize(result.url), title, via: result.via };
}

// ── Running a play ─────────────────────────────────────────────────────────

// Starts the play and returns as soon as Freckle accepts it. Use follow() for the result.
export async function run(tab, playId) {
  const auth = await getAuth();
  if (!auth?.token || !auth.orgId) return { ok: false, error: 'Sign in to Freckle in the side panel first.' };
  const page = await resolvePage(tab);
  if (page.error) return { ok: false, ...page };

  let cache = await getCache(auth.orgId);
  if (!cache?.plays) cache = await refresh(auth);
  const applicable = playsFor(cache.plays, page.pageType, await getHidden(auth.orgId));
  const play = playId
    ? cache.plays.find((p) => p.id === playId)
    : pickDefault(applicable, await getDefaults(auth.orgId), page.pageType);
  if (!play) return { ok: false, pageType: page.pageType, error: `No play takes ${withArticle(page.pageType)} yet.` };

  const base = { at: Date.now(), url: page.url, title: page.title, pageType: page.pageType, playId: play.id, playName: play.name, workflowUrl: play.url };
  try {
    const started = await freckle.startRun(auth.token, auth.orgId, play.id, inputsFor(play, page), {
      source: 'chrome-extension',
      page_title: page.title || null,
      sent_by: auth.me?.email || null,
    });
    await setDefault(auth.orgId, page.pageType, play.id);
    if (started.type !== 'accepted') {
      const error = (started.errors || []).map((e) => e.message || e._tag).filter(Boolean).join(' ') || 'Freckle rejected the inputs.';
      await pushHistory({ ...base, id: `rej-${Date.now()}`, status: 'rejected', error });
      return { ok: false, play, error };
    }
    const item = { ...base, id: started.runId, status: 'running' };
    await pushHistory(item);
    return { ok: true, play, runId: started.runId, item };
  } catch (e) {
    const error = e.status === 401 ? 'Your Freckle sign-in expired. Sign in again.'
      : e.body?._tag === 'WorkflowRunOutOfCredits' ? 'The workspace is out of credits. Ask your Freckle admin for more.'
        : e.message;
    await pushHistory({ ...base, id: `err-${Date.now()}`, status: 'error', error });
    return { ok: false, play, error, signedOut: e.status === 401 };
  }
}

// Polls a run until it finishes (or gives up after a few minutes) and records the result.
export async function follow(runId, { timeoutMs = 5 * 60_000 } = {}) {
  const auth = await getAuth();
  const started = Date.now();
  let delay = 1500;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 6000);
    let data;
    try { data = await freckle.getRunData(auth.token, auth.orgId, runId); } catch (e) {
      if (e.status === 401) return { status: 'error', error: 'Your Freckle sign-in expired.' };
      continue;
    }
    const patch = { status: data.status, credits: data.creditsConsumed ?? null };
    if (data.outputs) patch.outputs = data.outputs;
    if (data.error) patch.error = data.error.message;
    if (data.status === 'waiting') patch.note = 'Waiting on a step, such as an approval.';
    await patchHistory(runId, patch);
    if (FINAL.has(data.status)) return { ...patch };
  }
  await patchHistory(runId, { note: 'Still running. Check it in Freckle.' });
  return { status: 'running' };
}

// Picks up runs that were still going when the panel or browser closed.
export async function resumeRunning() {
  const h = await getHistory();
  const cutoff = Date.now() - 30 * 60_000;
  return h.filter((x) => (x.status === 'running' || x.status === 'waiting') && x.at > cutoff && !/^(rej|err)-/.test(x.id));
}

// ── Publishing (owners only) ───────────────────────────────────────────────

// Writes the play settings into the workflow's metadata, then reads it back to confirm.
export async function publish(workflowId, settings) {
  const auth = await getAuth();
  const current = await freckle.getWorkflow(auth.token, auth.orgId, workflowId);
  if (current.owner?.userId !== auth.me?.userId) throw new Error('Only the workflow owner can publish it here.');
  if (settings.enabled && !takesUrl(current)) throw new Error('This workflow needs a url input before reps can run it.');
  await freckle.updateWorkflowMetadata(auth.token, auth.orgId, workflowId, mergedMetadata(current.metadata, settings));
  const check = await freckle.getWorkflow(auth.token, auth.orgId, workflowId);
  const saved = playSettings(check);
  if (!saved || saved.enabled !== settings.enabled) throw new Error("Freckle didn't keep the change. Try again, or publish with the freckle-play skill.");
  return refresh(auth);
}

// State and the send action, shared by the side panel and the keyboard shortcut.
import * as freckle from './freckle.js';
import { classify, normalize, isSalesNavLead, extractSalesNavProfile, withArticle } from './pages.js';
import { intakeDatasets, toTarget, wantsDomain } from './discover.js';

const local = chrome.storage.local;

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

// Finds every workflow in the org that takes URLs through a webhook, and caches the
// result so the keyboard shortcut works without the panel open.
export async function refresh(auth) {
  const workbooks = await freckle.listWorkbooks(auth.token, auth.orgId);
  const intakes = intakeDatasets(workbooks);
  const perWorkbook = {};
  const found = await pool(intakes, 6, async (i) => {
    const sources = await freckle.listDatasetSources(auth.token, auth.orgId, i.workbook.id, i.dataset.id);
    return { i, sources };
  });
  const hooked = found.filter(({ sources }) => sources.some((x) => x.kind === 'webhook'));
  for (const { i } of hooked) perWorkbook[i.workbook.id] = (perWorkbook[i.workbook.id] || 0) + 1;
  const targets = hooked
    .map(({ i, sources }) => toTarget(i, sources, perWorkbook[i.workbook.id]))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
  const cache = { targets, fetchedAt: Date.now() };
  await local.set({ [`cache:${auth.orgId}`]: cache });
  return cache;
}

async function pool(items, size, fn) {
  const out = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      try { out[idx] = await fn(items[idx]); } catch (e) { if (e.status === 401) throw e; out[idx] = null; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out.filter(Boolean);
}

// Per person: workflows they've hidden from their own dropdown.
export async function getHidden(orgId) {
  return (await local.get(`hidden:${orgId}`))[`hidden:${orgId}`] || [];
}
export async function setHidden(orgId, id, hide) {
  const h = new Set(await getHidden(orgId));
  if (hide) h.add(id); else h.delete(id);
  await local.set({ [`hidden:${orgId}`]: [...h] });
}

export function targetsFor(targets, pageType, hidden = []) {
  return targets.filter((t) => !hidden.includes(t.id) && (t.pageTypes.length === 0 || t.pageTypes.includes(pageType)));
}

export async function getDefaults(orgId) {
  return (await local.get(`defaults:${orgId}`))[`defaults:${orgId}`] || {};
}
export async function setDefault(orgId, pageType, targetId) {
  const d = await getDefaults(orgId);
  d[pageType] = targetId;
  await local.set({ [`defaults:${orgId}`]: d });
}

export function pickDefault(applicable, defaults, pageType) {
  return applicable.find((t) => t.id === defaults[pageType]) || applicable[0] || null;
}

export async function getHistory() {
  return (await local.get('history')).history || [];
}
async function pushHistory(item) {
  const h = await getHistory();
  h.unshift(item);
  await local.set({ history: h.slice(0, 25) });
}

// Works out the URL to send for a tab. Only Sales Navigator leads need to read the page.
export async function resolvePage(tab) {
  const pageType = classify(tab.url || '');
  if (!pageType) return { error: "This page can't be sent. Open a website, LinkedIn, HubSpot or Salesforce page." };
  if (!isSalesNavLead(tab.url)) return { pageType, url: normalize(tab.url) };
  let result;
  try {
    [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractSalesNavProfile });
  } catch {
    return { pageType, error: 'Allow access to LinkedIn to send Sales Navigator leads.', needsLinkedIn: true };
  }
  if (!result?.url) return { pageType, error: "Couldn't find this lead's LinkedIn profile link. Wait for the page to finish loading and try again." };
  return { pageType, url: normalize(result.url), via: result.via };
}

export async function send(tab, targetId) {
  const auth = await getAuth();
  if (!auth?.token || !auth.orgId) return { ok: false, error: 'Sign in to Freckle in the side panel first.' };
  const page = await resolvePage(tab);
  if (page.error) return { ok: false, ...page };

  let cache = await getCache(auth.orgId);
  if (!cache) cache = await refresh(auth);
  const applicable = targetsFor(cache.targets, page.pageType, await getHidden(auth.orgId));
  const target = targetId
    ? cache.targets.find((t) => t.id === targetId)
    : pickDefault(applicable, await getDefaults(auth.orgId), page.pageType);
  if (!target) return { ok: false, pageType: page.pageType, error: `No workflow takes ${withArticle(page.pageType)} yet.` };

  const item = { at: Date.now(), url: page.url, title: tab.title || '', pageType: page.pageType, targetId: target.id, targetName: target.name, workbookUrl: target.workbookUrl };
  try {
    const entry = await freckle.createEntry(auth.token, auth.orgId, target.workbookId, target.datasetId, freckle.valueForPointer(target.field, wantsDomain(target.field) ? new URL(page.url).hostname.replace(/^www\./, '') : page.url));
    await setDefault(auth.orgId, page.pageType, target.id);
    await pushHistory({ ...item, ok: true, entryId: entry.id });
    return { ok: true, target, url: page.url, pageType: page.pageType, entry };
  } catch (e) {
    const error = e.status === 401 ? 'Your Freckle sign-in expired. Sign in again.' : e.message;
    await pushHistory({ ...item, ok: false, error });
    return { ok: false, target, url: page.url, pageType: page.pageType, error, signedOut: e.status === 401 };
  }
}

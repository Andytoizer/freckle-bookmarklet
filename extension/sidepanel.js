import * as freckle from './lib/freckle.js';
import * as core from './lib/core.js';
import { classify, isSalesNavLead, PAGE_TYPES, withArticle } from './lib/pages.js';
import { ICONS } from './lib/icons.js';

const $app = document.getElementById('app');

const S = {
  view: 'loading',        // loading | signin | org | main | settings | form
  auth: null,
  cache: null,
  defaults: {},
  history: [],
  windowId: null,
  tab: null,
  perm: { tabs: false, linkedin: false },
  signin: null,           // { state: starting|waiting|error, session, ctrl, error }
  sending: false,
  result: null,
  refreshing: false,
  error: null,
  form: null,             // add/edit workflow form state
  shortcut: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function icon(name, size = 16, cls = '') {
  const g = ICONS[`${name}-${size}`];
  if (!g) return '';
  // Some exported glyphs carry a full-size frame path; drop it so it doesn't paint a square.
  const body = g.body
    .replace(/<path d="M 0 0 L (\d+) 0 L \1 \1 L 0 \1 L 0 0 Z"[^>]*\/>/g, '')
    .replace(/\sfill="[^"]*"/g, '');
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="${g.viewBox}" fill="currentColor" aria-hidden="true">${body}</svg>`;
}

function marksFor(pageType, url, small = false) {
  const files = [...PAGE_TYPES[pageType].marks];
  if (url && isSalesNavLead(url)) files.push('sales-navigator.png');
  return files.map((f) => `<img class="mark ${small ? 'mark-sm' : ''}" src="assets/marks/${f}" alt="">`).join('');
}

function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function shortUrl(u) {
  try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, ''); } catch { return u || ''; }
}

const orgName = () => S.auth?.orgs?.find((o) => o.orgId === S.auth.orgId)?.name || 'your organization';

// ── Data ───────────────────────────────────────────────────────────────────

async function checkPerms() {
  S.perm.tabs = await chrome.permissions.contains({ permissions: ['tabs'] });
  S.perm.linkedin = await chrome.permissions.contains({ origins: ['https://www.linkedin.com/*'] });
}

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, windowId: S.windowId });
  if (!tab) { S.tab = null; return; }
  if (S.tab?.url !== tab.url) S.result = null;
  S.tab = tab;
}

async function refresh({ quiet = false } = {}) {
  if (!S.auth?.orgId) return;
  S.refreshing = true;
  if (!quiet) render();
  try {
    S.cache = await core.refresh(S.auth);
    S.error = null;
  } catch (e) {
    if (e.status === 401) return expire();
    S.error = e.message;
  }
  S.refreshing = false;
  render();
}

async function expire() {
  await core.signOut();
  S.auth = null; S.cache = null; S.view = 'signin';
  S.signin = { state: 'error', error: 'Your Freckle sign-in expired. Sign in again.' };
  render();
}

async function boot() {
  S.windowId = (await chrome.windows.getCurrent()).id;
  const cmd = (await chrome.commands.getAll()).find((c) => c.name === 'send-current-page');
  S.shortcut = cmd?.shortcut || '';
  await checkPerms();
  S.history = await core.getHistory();
  S.auth = await core.getAuth();
  if (!S.auth?.token) { S.view = 'signin'; return render(); }
  if (!S.auth.orgId) { S.view = 'org'; return render(); }
  S.cache = await core.getCache(S.auth.orgId);
  S.defaults = await core.getDefaults(S.auth.orgId);
  await loadTab();
  S.view = 'main';
  render();
  refresh({ quiet: !!S.cache });
}

// ── Views ──────────────────────────────────────────────────────────────────

function header({ title, back } = {}) {
  if (back) {
    return `<header class="bar">
      <button class="icon-btn" data-action="${back}" aria-label="Back"><span class="flip">${icon('arrow-right', 16)}</span></button>
      <span class="title">${esc(title)}</span>
    </header>`;
  }
  const signedIn = S.auth?.orgId;
  return `<header class="bar">
    <img class="stamp" src="assets/logos/stamp_black_full.svg" alt="">
    <span class="title">Send to Freckle${signedIn ? ` <span class="muted" style="font-weight:var(--weight-regular)">· ${esc(orgName())}</span>` : ''}</span>
    ${S.refreshing ? `<span class="subtle" title="Refreshing">${icon('circle-dashed', 12, 'spin')}</span>` : ''}
    ${signedIn ? `<button class="icon-btn" data-action="open-settings" title="Workflows and settings" aria-label="Workflows and settings">${icon('settings', 16)}</button>` : ''}
  </header>`;
}

function viewSignin() {
  const st = S.signin;
  let body;
  if (st?.state === 'waiting') {
    body = `
      <h1>Approve in Freckle</h1>
      <p>A Freckle tab just opened. Check that it shows this code, then approve.</p>
      <div class="code">${esc(st.session.userCode)}</div>
      <div class="waiting">${icon('circle-dashed', 16, 'spin')} Waiting for approval…</div>
      <div style="display:flex;gap:var(--space-8)">
        <button class="btn" data-action="reopen-approve">Open the Freckle tab again</button>
        <button class="btn" data-action="cancel-signin">Cancel</button>
      </div>`;
  } else {
    body = `
      <h1>Send any page to a Freckle workflow</h1>
      <p>Sign in to see the workflows your organization has set up. Pick one, and every LinkedIn profile, CRM record or company site you open is one click from a new row.</p>
      ${st?.state === 'error' ? `<div class="status err">${icon('circle-x-filled', 16)}<div class="body">${esc(st.error)}</div></div>` : ''}
      <button class="btn btn-primary btn-lg btn-block" data-action="signin" ${st?.state === 'starting' ? 'disabled' : ''}>
        ${st?.state === 'starting' ? `${icon('circle-dashed', 16, 'spin')} Starting…` : 'Sign in with Freckle'}
      </button>
      <p class="subtle">Uses the same sign-in as the Freckle CLI. You approve it in your browser.</p>`;
  }
  return `${header()}<main class="signin fade-in">${body}</main>`;
}

function viewOrg() {
  const orgs = [...(S.auth?.orgs || [])].sort((a, b) => a.name.localeCompare(b.name));
  return `${header()}
  <main class="main fade-in">
    <div>
      <label class="label" for="org">Which organization's workflows?</label>
      <div class="select-wrap">
        <select id="org" class="select select-lg">
          <option value="">Choose an organization</option>
          ${orgs.map((o) => `<option value="${esc(o.orgId)}">${esc(o.name)}</option>`).join('')}
        </select>
        <span class="chev">${icon('chevron-down', 16)}</span>
      </div>
      <p class="hint">You can switch later in settings.</p>
    </div>
  </main>`;
}

function pageCard() {
  const url = S.tab?.url;
  if (!url) {
    return `<div class="callout">
      <h3>Let Send to Freckle see which page you're on</h3>
      <p>The panel needs to read the current tab's address to send it, and LinkedIn pages to turn Sales Navigator leads into regular profile links. Nothing is read until you click Send.</p>
      <div><button class="btn btn-primary" data-action="grant">Allow</button></div>
      ${S.shortcut ? `<p>Or skip this and press <kbd>${esc(S.shortcut)}</kbd> on any page to send it to your default workflow.</p>` : ''}
    </div>`;
  }
  const type = classify(url);
  if (!type) {
    return `<div class="page empty"><div>This tab can't be sent. Open a website, LinkedIn, HubSpot or Salesforce page.</div></div>`;
  }
  return `<div class="page">
    <div class="marks">${marksFor(type, url)}</div>
    <div class="section-label">${esc(isSalesNavLead(url) ? 'Sales Navigator lead' : PAGE_TYPES[type].label)}</div>
    <div class="name">${esc(S.tab.title || shortUrl(url))}</div>
    <div class="url" title="${esc(url)}">${esc(shortUrl(url))}</div>
  </div>`;
}

function destLine(t) {
  if (!t) return '';
  const trig = t.trigger === 'auto'
    ? `<span class="dot dot-live"></span> runs automatically`
    : t.trigger === 'manual'
      ? `<span class="dot dot-wait"></span> waits for a manual run`
      : `<span class="dot dot-none"></span> no workflow reads this dataset yet`;
  return `<div class="dest">Adds a row to <span style="color:var(--text-body)">${esc(t.datasetLabel)}</span> · ${trig}</div>`;
}

function statusBlock() {
  const r = S.result;
  if (!r) return '';
  if (r.ok) {
    return `<div class="status ok fade-in">${icon('circle-check-filled', 16)}<div class="body">
      Sent to ${esc(r.target.name)}.
      ${r.target.workbookUrl ? `<a href="${esc(r.target.workbookUrl)}" target="_blank">Open in Freckle</a>` : ''}
    </div></div>`;
  }
  return `<div class="status err fade-in">${icon('circle-x-filled', 16)}<div class="body">${esc(r.error)}
    ${r.needsLinkedIn ? `<div style="margin-top:var(--space-6)"><button class="linkbtn" data-action="grant">Allow LinkedIn access</button></div>` : ''}
  </div></div>`;
}

function sendBlock() {
  const url = S.tab?.url;
  const type = url && classify(url);
  if (!type) return '';
  const reg = S.cache?.registry;
  if (!S.cache) return `<div class="waiting">${icon('circle-dashed', 16, 'spin')} Loading workflows…</div>`;
  if (!reg?.datasetId) {
    return `<div class="callout">
      <h3>No workflows set up for ${esc(orgName())} yet</h3>
      <p>Freckle keeps this list as a dataset in a workbook called “${esc(freckle.REGISTRY_WORKBOOK)}”, so anyone in the organization can add to it here or in Freckle.</p>
      <div><button class="btn btn-primary" data-action="create-registry">Create the list</button></div>
    </div>`;
  }
  const applicable = core.targetsFor(S.cache.targets, type);
  if (!applicable.length) {
    return `<div class="callout">
      <h3>No workflow takes ${esc(withArticle(type))} yet</h3>
      <p>Add one and it shows up here for everyone in ${esc(orgName())}.</p>
      <div><button class="btn" data-action="add-workflow" data-type="${type}">${icon('plus', 16)} Add workflow</button></div>
    </div>`;
  }
  const sel = core.pickDefault(applicable, S.defaults, type);
  return `<div class="send-block">
    <label class="label" for="target" style="margin:0">Send to</label>
    <div class="select-wrap">
      <select id="target" class="select select-lg" data-type="${type}">
        ${applicable.map((t) => `<option value="${esc(t.id)}" ${t.id === sel.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>
      <span class="chev">${icon('chevron-down', 16)}</span>
    </div>
    ${destLine(sel)}
    <button class="btn btn-primary btn-lg btn-block" data-action="send" ${S.sending ? 'disabled' : ''} style="margin-top:var(--space-8)">
      ${S.sending ? `${icon('circle-dashed', 16, 'spin')} Sending…` : 'Send to Freckle'}
      ${S.shortcut && !S.sending ? `<span class="kbd">${esc(S.shortcut)}</span>` : ''}
    </button>
    ${statusBlock()}
  </div>`;
}

function recent() {
  const h = S.history.slice(0, 8);
  return `<section>
    <div class="section-label" style="margin-bottom:var(--space-6)">Recent</div>
    ${h.length ? `<div class="list">${h.map((x) => `
      <div class="row" title="${esc(x.ok ? x.url : x.error)}">
        <span class="${x.ok ? 'ok' : 'err'}">${icon(x.ok ? 'circle-check-filled' : 'circle-x-filled', 12)}</span>
        <div class="grow">
          <div class="line1">${esc(x.title || shortUrl(x.url))}</div>
          <div class="line2">${x.ok ? esc(x.targetName) : esc(x.error)}</div>
        </div>
        <span class="when">${ago(x.at)}</span>
      </div>`).join('')}</div>`
      : `<div class="empty-note">Nothing sent yet.</div>`}
  </section>`;
}

function viewMain() {
  return `${header()}
  <main class="main fade-in">
    ${S.error ? `<div class="status err">${icon('alert-triangle', 16)}<div class="body">${esc(S.error)} <button class="linkbtn" data-action="refresh">Retry</button></div></div>` : ''}
    ${pageCard()}
    ${sendBlock()}
    ${recent()}
  </main>`;
}

function viewSettings() {
  const targets = S.cache?.targets || [];
  const reg = S.cache?.registry;
  const orgs = [...(S.auth?.orgs || [])].sort((a, b) => a.name.localeCompare(b.name));
  return `${header({ title: 'Workflows', back: 'back-main' })}
  <main class="main fade-in">
    <section>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6)">
        <span class="section-label">In ${esc(orgName())}</span>
        ${reg?.datasetId ? `<button class="btn" data-action="add-workflow">${icon('plus', 16)} Add</button>` : ''}
      </div>
      ${!reg?.datasetId
        ? `<div class="callout"><p>No list yet for this organization.</p><div><button class="btn btn-primary" data-action="create-registry">Create the list</button></div></div>`
        : targets.length
          ? `<div class="list">${targets.map((t) => `
            <div class="row">
              <div class="grow">
                <div class="line1" style="font-weight:var(--weight-medium)">${esc(t.name)}${t.broken ? ' <span style="color:var(--danger);font-weight:var(--weight-regular)">· dataset missing</span>' : ''}</div>
                <div class="line2"><span class="chips" style="display:inline-flex;vertical-align:-2px;margin-right:var(--space-4)">${(t.pageTypes.length ? t.pageTypes : ['website']).filter((p) => PAGE_TYPES[p]).map((p) => marksFor(p, null, true)).join('')}</span>${esc(t.pageTypes.length ? t.pageTypes.map((p) => PAGE_TYPES[p]?.label || p).join(', ') : 'Any page')} → ${esc(t.datasetLabel || 'unknown dataset')}</div>
              </div>
              <div class="row-actions">
                <button class="icon-btn" data-action="edit-workflow" data-id="${esc(t.id)}" aria-label="Edit ${esc(t.name)}">${icon('pencil', 12)}</button>
                <button class="icon-btn" data-action="delete-workflow" data-id="${esc(t.id)}" aria-label="Remove ${esc(t.name)}">${icon('trash', 12)}</button>
              </div>
            </div>`).join('')}</div>`
          : `<div class="empty-note">No workflows yet. Add the first one.</div>`}
      ${reg?.url ? `<p class="hint">Anyone in ${esc(orgName())} can also edit this list in Freckle: <a href="${esc(reg.url)}" target="_blank">${esc(freckle.REGISTRY_WORKBOOK)} workbook</a>.</p>` : ''}
    </section>

    <section>
      <div class="section-label" style="margin-bottom:var(--space-6)">Organization</div>
      <div class="select-wrap">
        <select id="org-switch" class="select">
          ${orgs.map((o) => `<option value="${esc(o.orgId)}" ${o.orgId === S.auth.orgId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
        </select>
        <span class="chev">${icon('chevron-down', 12)}</span>
      </div>
    </section>

    <section>
      <div class="section-label" style="margin-bottom:var(--space-6)">Keyboard shortcut</div>
      <p class="hint" style="margin:0">${S.shortcut ? `<kbd>${esc(S.shortcut)}</kbd> sends the current page to its default workflow.` : 'No shortcut set.'}
        <button class="linkbtn" data-action="shortcuts">Change</button></p>
    </section>

    <section>
      <div class="section-label" style="margin-bottom:var(--space-6)">Page access</div>
      <p class="hint" style="margin:0">${S.perm.tabs && S.perm.linkedin ? 'Allowed. The panel can see the current tab and read Sales Navigator leads.' : 'Not allowed yet.'}
        ${S.perm.tabs && S.perm.linkedin ? '' : '<button class="linkbtn" data-action="grant">Allow</button>'}</p>
    </section>
  </main>
  <footer class="foot"><div class="line">Signed in to Freckle. <button class="linkbtn" data-action="signout">Sign out</button></div></footer>`;
}

function guessField(paths) {
  const prefs = [/linkedin.*url/i, /profile.*url/i, /(^|\/)url$/i, /website|domain/i, /url/i];
  for (const re of prefs) { const p = paths.find((x) => re.test(x)); if (p) return p; }
  return paths[0] || '/url';
}

function viewForm() {
  const f = S.form;
  const workbooks = (S.cache?.workbooks || []).filter((w) => w.label !== freckle.REGISTRY_WORKBOOK).sort((a, b) => a.label.localeCompare(b.label));
  const wb = workbooks.find((w) => w.id === f.workbookId);
  const datasets = wb?.datasets || [];
  const ds = datasets.find((d) => d.id === f.datasetId);
  const paths = ds?.fieldPaths || [];
  const conn = wb?.connections.find((c) => c.inputDatasetId === f.datasetId);
  const custom = f.fieldMode === 'custom' || (ds && !paths.length);
  const canSave = f.name.trim() && f.workbookId && f.datasetId && f.field.trim() && !f.saving;
  return `${header({ title: f.id ? 'Edit workflow' : 'Add workflow', back: 'back-settings' })}
  <main class="main fade-in">
    <form class="form" id="wf-form" autocomplete="off">
      <div>
        <label class="label" for="f-name">Name</label>
        <input id="f-name" class="field" value="${esc(f.name)}" placeholder="LinkedIn to phone and email" maxlength="80">
        <p class="hint">What reps see in the dropdown.</p>
      </div>
      <div>
        <label class="label" for="f-wb">Workbook</label>
        <div class="select-wrap"><select id="f-wb" class="select">
          <option value="">Choose a workbook</option>
          ${workbooks.map((w) => `<option value="${esc(w.id)}" ${w.id === f.workbookId ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}
        </select><span class="chev">${icon('chevron-down', 12)}</span></div>
      </div>
      <div>
        <label class="label" for="f-ds">Dataset the page lands in</label>
        <div class="select-wrap"><select id="f-ds" class="select" ${wb ? '' : 'disabled'}>
          <option value="">${wb ? 'Choose a dataset' : 'Choose a workbook first'}</option>
          ${datasets.map((d) => `<option value="${esc(d.id)}" ${d.id === f.datasetId ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}
        </select><span class="chev">${icon('chevron-down', 12)}</span></div>
        ${ds ? `<div class="hint">${conn
          ? (conn.triggerPolicy === 'auto'
            ? '<span class="dot dot-live"></span> Its workflow runs automatically on new rows.'
            : '<span class="dot dot-wait"></span> Its workflow is set to manual, so rows wait until someone runs it. Switch the connection to auto in Freckle to run on every send.')
          : '<span class="dot dot-none"></span> No workflow reads this dataset yet.'}</div>` : ''}
      </div>
      <div>
        <label class="label" for="f-field">Field that gets the URL</label>
        ${custom
          ? `<input id="f-field" class="field mono" value="${esc(f.field)}" placeholder="/linkedin_url">`
          : ds
            ? `<div class="select-wrap"><select id="f-field-sel" class="select mono">
                ${paths.map((p) => `<option value="${esc(p)}" ${p === f.field ? 'selected' : ''}>${esc(p)}</option>`).join('')}
                <option value="__custom">Other field…</option>
              </select><span class="chev">${icon('chevron-down', 12)}</span></div>`
            : `<div class="select-wrap"><select class="select" disabled><option>Choose a dataset first</option></select><span class="chev">${icon('chevron-down', 12)}</span></div>`}
      </div>
      <div>
        <span class="label">Pages it takes</span>
        <div class="checks">
          ${Object.entries(PAGE_TYPES).map(([k, v]) => `
            <label class="check">
              <input type="checkbox" name="pt" value="${k}" ${f.pageTypes.includes(k) ? 'checked' : ''}>
              <span class="box">${icon('check', 12)}</span>
              ${marksFor(k, null, true)} ${esc(v.label)}
            </label>`).join('')}
        </div>
        <p class="hint">Leave all unchecked to offer it on any page.</p>
      </div>
      ${f.error ? `<div class="status err">${icon('circle-x-filled', 16)}<div class="body">${esc(f.error)}</div></div>` : ''}
      <div class="form-actions">
        <button type="button" class="btn" data-action="back-settings">Cancel</button>
        <button type="submit" class="btn btn-primary" ${canSave ? '' : 'disabled'}>${f.saving ? 'Saving…' : 'Save for everyone'}</button>
      </div>
    </form>
  </main>`;
}

let lastView = null;
function render() {
  const views = { loading: () => `${header()}<main class="main"><div class="waiting">${icon('circle-dashed', 16, 'spin')} Loading…</div></main>`, signin: viewSignin, org: viewOrg, main: viewMain, settings: viewSettings, form: viewForm };
  const active = document.activeElement?.id;
  $app.innerHTML = views[S.view]();
  // Animate only when the screen changes, not on every re-render.
  if (S.view === lastView) $app.querySelectorAll('.fade-in').forEach((el) => el.classList.remove('fade-in'));
  lastView = S.view;
  if (active) document.getElementById(active)?.focus();
}

// ── Actions ────────────────────────────────────────────────────────────────

async function signin() {
  S.signin = { state: 'starting' };
  render();
  try {
    const session = await freckle.startDeviceAuth();
    const ctrl = new AbortController();
    S.signin = { state: 'waiting', session, ctrl };
    render();
    chrome.tabs.create({ url: session.approveUrl });
    const token = await freckle.waitForApproval(session, ctrl.signal);
    const orgs = await freckle.listOrganizations(token);
    S.auth = { token, orgs, orgId: orgs.length === 1 ? orgs[0].orgId : null };
    await core.setAuth(S.auth);
    S.signin = null;
    boot();
  } catch (e) {
    S.signin = e.message === 'Sign-in cancelled.' ? null : { state: 'error', error: e.message };
    render();
  }
}

async function chooseOrg(orgId) {
  if (!orgId) return;
  S.auth.orgId = orgId;
  await core.setAuth(S.auth);
  S.cache = null; S.result = null;
  boot();
}

async function grant() {
  await chrome.permissions.request({ permissions: ['tabs'], origins: ['https://www.linkedin.com/*'] });
  await checkPerms();
  await loadTab();
  render();
}

async function doSend() {
  if (!S.tab || S.sending) return;
  const targetId = document.getElementById('target')?.value;
  S.sending = true; S.result = null;
  render();
  const r = await core.send(S.tab, targetId);
  S.sending = false;
  if (r.signedOut) return expire();
  S.result = r;
  S.defaults = await core.getDefaults(S.auth.orgId);
  S.history = await core.getHistory();
  render();
}

async function createRegistry() {
  try {
    S.refreshing = true; render();
    await freckle.ensureRegistry(S.auth.token, S.auth.orgId, await freckle.listWorkbooks(S.auth.token, S.auth.orgId));
    await refresh({ quiet: true });
    openForm();
  } catch (e) {
    S.refreshing = false; S.error = e.message; render();
  }
}

function openForm(target, pageType) {
  S.form = target
    ? { id: target.id, name: target.name, workbookId: target.workbookId, datasetId: target.datasetId, field: target.field, fieldMode: 'pick', pageTypes: [...target.pageTypes], saving: false, error: null }
    : { id: null, name: '', workbookId: '', datasetId: '', field: '', fieldMode: 'pick', pageTypes: pageType ? [pageType] : [], saving: false, error: null };
  if (target) {
    const ds = S.cache.workbooks.find((w) => w.id === target.workbookId)?.datasets.find((d) => d.id === target.datasetId);
    if (ds && !ds.fieldPaths.includes(target.field)) S.form.fieldMode = 'custom';
  }
  S.view = 'form';
  render();
}

async function saveForm() {
  const f = S.form;
  const reg = S.cache.registry;
  const value = { name: f.name.trim(), workbookId: f.workbookId, datasetId: f.datasetId, field: freckle.normalizePointer(f.field), pageTypes: f.pageTypes.join(', ') };
  f.saving = true; f.error = null; render();
  try {
    if (f.id) await freckle.updateEntry(S.auth.token, S.auth.orgId, reg.workbookId, reg.datasetId, f.id, value);
    else await freckle.createEntry(S.auth.token, S.auth.orgId, reg.workbookId, reg.datasetId, value);
    await refresh({ quiet: true });
    S.view = 'settings';
    render();
  } catch (e) {
    if (e.status === 401) return expire();
    f.saving = false; f.error = e.message; render();
  }
}

async function deleteWorkflow(id) {
  const t = S.cache.targets.find((x) => x.id === id);
  if (!t || !confirm(`Remove “${t.name}” for everyone in ${orgName()}?`)) return;
  const reg = S.cache.registry;
  try {
    await freckle.deleteEntries(S.auth.token, S.auth.orgId, reg.workbookId, reg.datasetId, [id]);
    await refresh({ quiet: true });
  } catch (e) {
    if (e.status === 401) return expire();
    S.error = e.message; render();
  }
}

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'signin') signin();
  else if (a === 'cancel-signin') { S.signin?.ctrl?.abort(); S.signin = null; render(); }
  else if (a === 'reopen-approve') chrome.tabs.create({ url: S.signin.session.approveUrl });
  else if (a === 'grant') grant();
  else if (a === 'send') doSend();
  else if (a === 'refresh') refresh();
  else if (a === 'create-registry') createRegistry();
  else if (a === 'open-settings') { S.view = 'settings'; render(); }
  else if (a === 'back-main') { S.view = 'main'; render(); }
  else if (a === 'back-settings') { S.view = S.cache?.targets?.length || S.form?.id ? 'settings' : 'main'; S.form = null; render(); }
  else if (a === 'add-workflow') openForm(null, el.dataset.type);
  else if (a === 'edit-workflow') openForm(S.cache.targets.find((t) => t.id === el.dataset.id));
  else if (a === 'delete-workflow') deleteWorkflow(el.dataset.id);
  else if (a === 'shortcuts') chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  else if (a === 'signout') { core.signOut().then(() => { S.auth = null; S.cache = null; S.view = 'signin'; S.signin = null; render(); }); }
});

$app.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'org') chooseOrg(t.value);
  else if (t.id === 'org-switch') chooseOrg(t.value);
  else if (t.id === 'target') {
    await core.setDefault(S.auth.orgId, t.dataset.type, t.value);
    S.defaults = await core.getDefaults(S.auth.orgId);
    S.result = null;
    render();
  } else if (S.view === 'form') {
    const f = S.form;
    if (t.id === 'f-wb') { f.workbookId = t.value; f.datasetId = ''; f.field = ''; f.fieldMode = 'pick'; }
    else if (t.id === 'f-ds') {
      f.datasetId = t.value; f.fieldMode = 'pick';
      const ds = S.cache.workbooks.find((w) => w.id === f.workbookId)?.datasets.find((d) => d.id === t.value);
      f.field = ds ? guessField(ds.fieldPaths) : '';
      if (ds && !ds.fieldPaths.length) f.fieldMode = 'custom';
    } else if (t.id === 'f-field-sel') {
      if (t.value === '__custom') { f.fieldMode = 'custom'; f.field = ''; } else f.field = t.value;
    } else if (t.name === 'pt') {
      f.pageTypes = [...document.querySelectorAll('input[name="pt"]:checked')].map((x) => x.value);
    }
    render();
    if (t.value === '__custom') document.getElementById('f-field')?.focus();
  }
});

$app.addEventListener('input', (e) => {
  if (S.view !== 'form') return;
  if (e.target.id === 'f-name') S.form.name = e.target.value;
  else if (e.target.id === 'f-field') S.form.field = e.target.value;
  else return;
  const f = S.form;
  const btn = document.querySelector('#wf-form button[type="submit"]');
  if (btn) btn.disabled = !(f.name.trim() && f.workbookId && f.datasetId && f.field.trim());
});

$app.addEventListener('submit', (e) => { e.preventDefault(); saveForm(); });

// ── Keep up with the browser ───────────────────────────────────────────────

const onTabChange = async () => { if (S.view === 'main' || S.view === 'loading') { await loadTab(); render(); } };
chrome.tabs.onActivated.addListener(({ windowId }) => { if (windowId === S.windowId) onTabChange(); });
chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (tab.active && tab.windowId === S.windowId && (info.url || info.title || info.status === 'complete')) onTabChange();
});
chrome.permissions.onAdded.addListener(async () => { await checkPerms(); await loadTab(); render(); });

chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.history) { S.history = changes.history.newValue || []; if (S.view === 'main') render(); }
  if (S.auth?.orgId && changes[`defaults:${S.auth.orgId}`]) S.defaults = changes[`defaults:${S.auth.orgId}`].newValue || {};
});

window.addEventListener('focus', () => {
  if (S.auth?.orgId && (!S.cache || Date.now() - S.cache.fetchedAt > 60_000)) refresh({ quiet: true });
});
setInterval(() => { if (S.view === 'main') render(); }, 60_000); // keeps "2m ago" honest

boot();

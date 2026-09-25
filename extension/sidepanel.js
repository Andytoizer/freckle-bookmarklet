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
  hidden: [],             // workflow ids this person unchecked
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
  S.hidden = await core.getHidden(S.auth.orgId);
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
  // Chrome's side panel already shows the extension's icon and name above this,
  // so the header carries the organization instead of repeating the title.
  if (!S.auth?.orgId) return '';
  return `<header class="bar">
    <span class="section-label">Org</span>
    <span class="title">${esc(orgName())}</span>
    ${S.refreshing ? `<span class="subtle" title="Refreshing">${icon('circle-dashed', 12, 'spin')}</span>` : ''}
    <button class="icon-btn" data-action="open-settings" title="Workflows and settings" aria-label="Workflows and settings">${icon('settings', 16)}</button>
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
      <img src="assets/logos/stamp_gradient.png" alt="" width="40" height="40" style="border-radius:var(--radius-md)">
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
  if (!S.cache) return `<div class="waiting">${icon('circle-dashed', 16, 'spin')} Finding workflows…</div>`;
  const visible = S.cache.targets.filter((t) => !S.hidden.includes(t.id));
  if (!visible.length) {
    return `<div class="callout">
      <h3>No workflows take URLs in ${esc(orgName())} yet</h3>
      <p>A workflow shows up here on its own once its workbook takes URLs through a webhook. Your coding agent can build one in a few minutes.</p>
      <div><button class="btn btn-primary" data-action="build">Build one with your coding agent ${icon('arrow-up-right', 12)}</button></div>
    </div>`;
  }
  const applicable = core.targetsFor(S.cache.targets, type, S.hidden);
  if (!applicable.length) {
    return `<div class="callout">
      <h3>No workflow takes ${esc(withArticle(type))} yet</h3>
      <p>Workflows that take ${esc(withArticle(type))} show up here on their own.</p>
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
  const orgs = [...(S.auth?.orgs || [])].sort((a, b) => a.name.localeCompare(b.name));
  const pages = (t) => (t.pageTypes.length ? t.pageTypes.map((p) => PAGE_TYPES[p].label).join(', ') : 'Any page');
  return `${header({ title: 'Settings', back: 'back-main' })}
  <main class="main fade-in">
    <section>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6)">
        <span class="section-label">Workflows in ${esc(orgName())}</span>
        <button class="linkbtn" data-action="refresh">Refresh</button>
      </div>
      ${targets.length
        ? `<div class="list">${targets.map((t) => `
          <label class="row check" style="cursor:pointer">
            <div class="grow">
              <div class="line1" style="font-weight:var(--weight-medium)">${esc(t.name)}</div>
              <div class="line2">${esc(pages(t))} · ${t.trigger === 'auto' ? 'runs automatically' : 'waits for a manual run'}</div>
            </div>
            <input type="checkbox" name="show" value="${esc(t.id)}" ${S.hidden.includes(t.id) ? '' : 'checked'}>
            <span class="box">${icon('check', 12)}</span>
          </label>`).join('')}</div>
          <p class="hint">Found automatically: every workflow whose workbook takes URLs through a webhook. Uncheck any you don't want in your dropdown.</p>`
        : `<div class="empty-note">None yet. A workflow shows up here on its own once its workbook takes URLs through a webhook.</div>`}
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

let lastView = null;
function render() {
  const views = { loading: () => `${header()}<main class="main"><div class="waiting">${icon('circle-dashed', 16, 'spin')} Loading…</div></main>`, signin: viewSignin, org: viewOrg, main: viewMain, settings: viewSettings,  };
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
  else if (a === 'open-settings') { S.view = 'settings'; render(); }
  else if (a === 'back-main') { S.view = 'main'; render(); }
  else if (a === 'build') chrome.tabs.create({ url: 'https://freckle-bookmarklet.vercel.app' });
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
  } else if (t.name === 'show') {
    await core.setHidden(S.auth.orgId, t.value, !t.checked);
    S.hidden = await core.getHidden(S.auth.orgId);
  }
});

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

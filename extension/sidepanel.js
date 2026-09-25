import * as freckle from './lib/freckle.js';
import * as core from './lib/core.js';
import { classify, isSalesNavLead, PAGE_TYPES, withArticle } from './lib/pages.js';
import { ICONS } from './lib/icons.js';

const $app = document.getElementById('app');

const S = {
  view: 'loading',        // loading | signin | org | main | settings
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
  hidden: [],             // play ids this person unchecked
  publishing: null,       // workflow id being published
  publishError: null,
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
  for (const x of await core.resumeRunning()) core.follow(x.id);
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
    <button class="icon-btn" data-action="open-settings" title="Plays and settings" aria-label="Plays and settings">${icon('settings', 16)}</button>
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

function credits(p) {
  if (p.maxCredits === null || p.maxCredits === undefined) return '';
  const n = Number(p.maxCredits.toFixed(2));
  return `up to ${n} credit${n === 1 ? '' : 's'}${p.hasDynamicCost ? ' plus usage' : ''}`;
}

function playLine(p) {
  if (!p) return '';
  const bits = [p.returns, credits(p)].filter(Boolean).map(esc);
  return bits.length ? `<div class="dest">${bits.join(' · ')}</div>` : '';
}

// Flattens run outputs into label/value rows a rep can read and copy.
function outputRows(outputs) {
  const rows = [];
  const label = (k) => k.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  const add = (k, v) => {
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) rows.push([label(k), v.every((x) => typeof x !== 'object') ? v.join(', ') : `${v.length} item${v.length === 1 ? '' : 's'}`]);
    else if (typeof v === 'object') for (const [k2, v2] of Object.entries(v)) { if (typeof v2 !== 'object' || v2 === null) add(k2, v2); }
    else rows.push([label(k), String(v)]);
  };
  for (const [k, v] of Object.entries(outputs || {})) add(k, v);
  return rows.slice(0, 14);
}

function resultBlock() {
  const r = S.result;
  if (!r) return '';
  if (!r.ok) {
    return `<div class="status err fade-in">${icon('circle-x-filled', 16)}<div class="body">${esc(r.error)}
      ${r.needsLinkedIn ? `<div style="margin-top:var(--space-6)"><button class="linkbtn" data-action="grant">Allow LinkedIn access</button></div>` : ''}
    </div></div>`;
  }
  const item = S.history.find((x) => x.id === r.runId) || { status: 'running' };
  const link = r.play.url ? `<a href="${esc(r.play.url)}" target="_blank">Open in Freckle</a>` : '';
  if (item.status === 'running' || item.status === 'accepted' || item.status === 'waiting') {
    return `<div class="status run fade-in">${icon('circle-dashed', 16, 'spin')}<div class="body">Running ${esc(r.play.name)}…
      ${item.note ? `<div class="muted">${esc(item.note)}</div>` : ''}</div></div>`;
  }
  if (item.status === 'completed') {
    const rows = outputRows(item.outputs);
    return `<div class="result fade-in">
      <div class="result-head">${icon('circle-check-filled', 16)}<span>${esc(r.play.name)} finished</span>${item.credits ? `<span class="when">${esc(item.credits)} cr</span>` : ''}</div>
      ${rows.length ? `<dl class="outputs">${rows.map(([k, v], i) => `
        <div class="out"><dt>${esc(k)}</dt><dd><span class="val">${esc(v)}</span>
          <button class="icon-btn copy" data-action="copy" data-i="${i}" aria-label="Copy ${esc(k)}">${icon('copy', 12)}</button></dd></div>`).join('')}</dl>`
        : `<p class="muted" style="padding:0 var(--space-12) var(--space-12)">Done. This play doesn't return anything to show here.</p>`}
      <div class="result-foot">${link}</div>
    </div>`;
  }
  return `<div class="status err fade-in">${icon('circle-x-filled', 16)}<div class="body">${esc(r.play.name)} ${esc(item.status)}. ${esc(item.error || '')} ${link}</div></div>`;
}

function sendBlock() {
  const url = S.tab?.url;
  const type = url && classify(url);
  if (!type) return '';
  if (!S.cache?.plays) return `<div class="waiting">${icon('circle-dashed', 16, 'spin')} Loading plays…</div>`;
  const visible = S.cache.plays.filter((p) => !S.hidden.includes(p.id));
  if (!visible.length) {
    const ready = (S.cache.mine || []).filter((w) => w.ready && !w.settings?.enabled).length;
    return `<div class="callout">
      <h3>No plays published in ${esc(orgName())} yet</h3>
      <p>An operator publishes a workflow as a play, and it shows up here for everyone in the organization.</p>
      ${ready ? `<div><button class="btn btn-primary" data-action="open-settings">Publish one of your workflows</button></div>` : ''}
    </div>`;
  }
  const applicable = core.playsFor(S.cache.plays, type, S.hidden);
  if (!applicable.length) {
    return `<div class="callout">
      <h3>No play takes ${esc(withArticle(type))} yet</h3>
      <p>Plays for ${esc(withArticle(type))} show up here once an operator publishes one.</p>
    </div>`;
  }
  const sel = core.pickDefault(applicable, S.defaults, type);
  return `<div class="send-block">
    <label class="label" for="target" style="margin:0">Play</label>
    <div class="select-wrap">
      <select id="target" class="select select-lg" data-type="${type}">
        ${applicable.map((p) => `<option value="${esc(p.id)}" ${p.id === sel.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
      <span class="chev">${icon('chevron-down', 16)}</span>
    </div>
    ${playLine(sel)}
    <button class="btn btn-primary btn-lg btn-block" data-action="send" ${S.sending ? 'disabled' : ''} style="margin-top:var(--space-8)">
      ${S.sending ? `${icon('circle-dashed', 16, 'spin')} Starting…` : 'Run'}
      ${S.shortcut && !S.sending ? `<span class="kbd">${esc(S.shortcut)}</span>` : ''}
    </button>
    ${resultBlock()}
  </div>`;
}

const STATUS_ICON = { completed: ['ok', 'circle-check-filled'], failed: ['err', 'circle-x-filled'], cancelled: ['err', 'circle-x-filled'], rejected: ['err', 'circle-x-filled'], error: ['err', 'circle-x-filled'] };

function recent() {
  const h = S.history.slice(0, 8);
  return `<section>
    <div class="section-label" style="margin-bottom:var(--space-6)">Recent</div>
    ${h.length ? `<div class="list">${h.map((x) => {
      const [cls, ic] = STATUS_ICON[x.status] || ['subtle', 'circle-dashed'];
      const line2 = x.status === 'completed' ? x.playName : x.error ? `${x.playName}: ${x.error}` : `${x.playName} · ${x.status}`;
      return `<div class="row" title="${esc(x.url)}">
        <span class="${cls}">${icon(ic, 12, cls === 'subtle' ? 'spin' : '')}</span>
        <div class="grow">
          <div class="line1">${esc(x.title || shortUrl(x.url))}</div>
          <div class="line2">${esc(line2)}</div>
        </div>
        <span class="when">${ago(x.at)}</span>
      </div>`;
    }).join('')}</div>`
      : `<div class="empty-note">No plays run yet.</div>`}
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

const pagesLabel = (pages) => (pages.length ? pages.map((p) => PAGE_TYPES[p]?.label || p).join(', ') : 'Any page');

function yourWorkflows() {
  const mine = S.cache?.mine || [];
  if (!mine.length) return '';
  const ready = mine.filter((w) => w.ready);
  const notReady = mine.length - ready.length;
  return `<section>
    <div class="section-label" style="margin-bottom:var(--space-6)">Your workflows</div>
    ${ready.length ? `<div class="list">${ready.map((w) => {
      const on = !!w.settings?.enabled;
      const pages = Array.isArray(w.settings?.pages) ? w.settings.pages : [];
      const busy = S.publishing === w.id;
      return `<div class="pub">
        <label class="row check" style="cursor:pointer">
          <div class="grow">
            <div class="line1" style="font-weight:var(--weight-medium)">${esc(w.label)}</div>
            <div class="line2">${on ? `Published · ${esc(pagesLabel(pages))}` : 'Not published'}</div>
          </div>
          ${busy ? icon('circle-dashed', 12, 'spin') : ''}
          <input type="checkbox" name="publish" value="${esc(w.id)}" ${on ? 'checked' : ''} ${busy ? 'disabled' : ''}>
          <span class="switch" aria-hidden="true"></span>
        </label>
        ${on ? `<div class="chips-row">${Object.entries(PAGE_TYPES).map(([k, v]) => `
          <label class="chip ${pages.includes(k) ? 'on' : ''}"><input type="checkbox" name="pub-page" data-wf="${esc(w.id)}" value="${k}" ${pages.includes(k) ? 'checked' : ''} ${busy ? 'disabled' : ''}>${marksFor(k, null, true)} ${esc(v.label)}</label>`).join('')}
          <span class="hint" style="margin:0">None selected means any page.</span></div>` : ''}
      </div>`;
    }).join('')}</div>` : ''}
    ${S.publishError ? `<div class="status err" style="margin-top:var(--space-8)">${icon('circle-x-filled', 16)}<div class="body">${esc(S.publishError)}</div></div>` : ''}
    <p class="hint">Publishing makes a workflow a play for everyone in ${esc(orgName())}. Only workflows with a <span class="mono">url</span> input can be published.${notReady ? ` ${notReady} of yours need one first; the freckle-play skill can add it.` : ''}</p>
  </section>`;
}

function viewSettings() {
  const plays = S.cache?.plays || [];
  const orgs = [...(S.auth?.orgs || [])].sort((a, b) => a.name.localeCompare(b.name));
  return `${header({ title: 'Settings', back: 'back-main' })}
  <main class="main fade-in">
    <section>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6)">
        <span class="section-label">Plays in ${esc(orgName())}</span>
        <button class="linkbtn" data-action="refresh">Refresh</button>
      </div>
      ${plays.length
        ? `<div class="list">${plays.map((p) => `
          <label class="row check" style="cursor:pointer">
            <div class="grow">
              <div class="line1" style="font-weight:var(--weight-medium)">${esc(p.name)}</div>
              <div class="line2">${esc([pagesLabel(p.pages), credits(p)].filter(Boolean).join(' · '))}</div>
            </div>
            <input type="checkbox" name="show" value="${esc(p.id)}" ${S.hidden.includes(p.id) ? '' : 'checked'}>
            <span class="box">${icon('check', 12)}</span>
          </label>`).join('')}</div>
          <p class="hint">Uncheck a play to hide it from your own dropdown.</p>`
        : `<div class="empty-note">No plays published yet.</div>`}
    </section>

    ${yourWorkflows()}

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
      <p class="hint" style="margin:0">${S.shortcut ? `<kbd>${esc(S.shortcut)}</kbd> runs the default play for the page you're on.` : 'No shortcut set.'}
        <button class="linkbtn" data-action="shortcuts">Change</button></p>
    </section>

    <section>
      <div class="section-label" style="margin-bottom:var(--space-6)">Page access</div>
      <p class="hint" style="margin:0">${S.perm.tabs && S.perm.linkedin ? 'Allowed. The panel can see the current tab and read Sales Navigator leads.' : 'Not allowed yet.'}
        ${S.perm.tabs && S.perm.linkedin ? '' : '<button class="linkbtn" data-action="grant">Allow</button>'}</p>
    </section>
  </main>
  <footer class="foot"><div class="line">Signed in${S.auth?.me?.email ? ` as ${esc(S.auth.me.email)}` : ''}. <button class="linkbtn" data-action="signout">Sign out</button></div></footer>`;
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
  const playId = document.getElementById('target')?.value;
  S.sending = true; S.result = null;
  render();
  const r = await core.run(S.tab, playId);
  S.sending = false;
  if (r.signedOut) return expire();
  S.result = r;
  S.defaults = await core.getDefaults(S.auth.orgId);
  S.history = await core.getHistory();
  render();
  if (r.ok) core.follow(r.runId); // history updates re-render the result as it lands
}

async function togglePublish(workflowId, patch) {
  const w = S.cache.mine.find((x) => x.id === workflowId);
  const current = w.settings || {};
  const settings = {
    enabled: current.enabled ?? false,
    name: current.name || w.label,
    pages: Array.isArray(current.pages) ? current.pages : [],
    returns: current.returns || w.description || '',
    ...patch,
  };
  S.publishing = workflowId; S.publishError = null;
  render();
  try {
    S.cache = await core.publish(workflowId, settings);
  } catch (e) {
    if (e.status === 401) return expire();
    S.publishError = e.message;
  }
  S.publishing = null;
  render();
}

function copyOutput(i) {
  const item = S.history.find((x) => x.id === S.result?.runId);
  const row = outputRows(item?.outputs)[Number(i)];
  if (!row) return;
  navigator.clipboard.writeText(row[1]).catch(() => {});
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
  else if (a === 'copy') copyOutput(el.dataset.i);
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
  } else if (t.name === 'publish') {
    togglePublish(t.value, { enabled: t.checked });
  } else if (t.name === 'pub-page') {
    const pages = [...document.querySelectorAll(`input[name="pub-page"][data-wf="${t.dataset.wf}"]:checked`)].map((x) => x.value);
    togglePublish(t.dataset.wf, { pages });
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

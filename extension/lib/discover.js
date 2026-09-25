// Finds the workflows a page can be sent to, straight from the org's workbooks.
// No setup: a workflow shows up when its intake dataset takes URLs through a webhook.
//
// Rules, checked against real org data:
// - The dataset feeds a workflow and isn't another workflow's output (it's an intake).
// - It has a webhook source. CSV, search and workflow-output datasets are left out.
// - The webhook is keyed on a URL field (/url, /linkedin_url, …), or has no key and the
//   dataset has a URL field. A webhook keyed on something else, like /reference_id,
//   belongs to an integration that sends its own records, so it's left out.

const URL_FIELD = /(^|[\/_\s-])(url|link|linkedin|website|domain|profile[_\s-]?url)([\/_\s-]|$)|url$/i;

export const isUrlField = (path) => URL_FIELD.test(String(path || ''));

function bestUrlField(paths) {
  const prefs = [/^\/url$/i, /page_?url/i, /linkedin.*url/i, /profile.*url/i, /website/i, /url/i, /domain/i];
  for (const re of prefs) {
    const hit = paths.find((p) => re.test(p) && !p.slice(1).includes('/'));
    if (hit) return hit;
  }
  return null;
}

// Which pages a field suits, from its name. A generic /url takes any page.
export function inferPageTypes(field) {
  const f = String(field).toLowerCase();
  if (/hubspot/.test(f)) return ['hubspot_record'];
  if (/salesforce|sfdc/.test(f)) return ['salesforce_record'];
  if (/linkedin/.test(f) && /company|org|account/.test(f)) return ['linkedin_company'];
  if (/linkedin|profile/.test(f)) return ['linkedin_profile'];
  if (/website|domain/.test(f)) return ['website'];
  return [];
}

// Domain fields get a bare hostname; everything else gets the full URL.
export const wantsDomain = (field) => /domain/i.test(field) && !/url/i.test(field);

export function intakeDatasets(workbooks) {
  const out = [];
  for (const w of workbooks) {
    const conns = w.connections || [];
    const produced = new Set(conns.map((c) => c.outputDatasetId));
    for (const d of w.datasets || []) {
      if (d.archivedAt || produced.has(d.id)) continue;
      const feeds = conns.filter((c) => c.inputDatasetId === d.id);
      if (feeds.length) out.push({ workbook: w, dataset: d, connections: feeds });
    }
  }
  return out;
}

export function toTarget({ workbook, dataset, connections }, sources, sameWorkbookCount = 1) {
  const hooks = (sources || []).filter((s) => s.kind === 'webhook');
  if (!hooks.length) return null;
  const paths = dataset.fieldPaths || [];
  let field = null;
  for (const h of hooks) {
    const key = h.config?.keyPath;
    if (key && isUrlField(key)) { field = key; break; }
  }
  if (!field && hooks.some((h) => !h.config?.keyPath)) {
    field = bestUrlField(paths) || (paths.length ? null : '/url'); // brand-new dataset: /url, as the setup prompt asks
  }
  if (!field) return null;
  const auto = connections.some((c) => c.triggerPolicy === 'auto');
  return {
    id: dataset.id,
    name: sameWorkbookCount > 1 ? `${workbook.label} · ${dataset.label}` : workbook.label,
    workbookId: workbook.id,
    datasetId: dataset.id,
    datasetLabel: dataset.label,
    workbookUrl: workbook.url || null,
    field,
    pageTypes: inferPageTypes(field),
    trigger: auto ? 'auto' : 'manual',
  };
}

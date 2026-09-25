// A play is a saved Freckle workflow that takes a page URL and has been published for reps.
//
// Contract, checked here so a mistake can't reach reps:
//   - input `url` (string, required)
//   - optional inputs `page_type`, `page_title`; no other required inputs
//   - metadata.repPlay = { enabled, name, pages, returns }
// Anything else is invisible to the extension.

export const PLAY_KEY = 'repPlay';
const PASSED_INPUTS = new Set(['url', 'page_type', 'page_title']);

export function takesUrl(workflow) {
  const inputs = workflow.shape?.inputs;
  if (!Array.isArray(inputs)) return false;
  const url = inputs.find((i) => i.id === 'url');
  if (!url || url.type !== 'string') return false;
  return inputs.every((i) => !i.required || PASSED_INPUTS.has(i.id));
}

export function playSettings(workflow) {
  const p = workflow.metadata?.[PLAY_KEY];
  return p && typeof p === 'object' ? p : null;
}

const estimate = (w) => (typeof w.costEstimate?.estimatedStaticCreditCost === 'number' ? w.costEstimate.estimatedStaticCreditCost : null);

export function toPlay(workflow) {
  const s = playSettings(workflow);
  if (!s?.enabled || !takesUrl(workflow)) return null;
  return {
    id: workflow.id,
    name: String(s.name || workflow.label),
    pages: Array.isArray(s.pages) ? s.pages.map(String) : [],
    returns: String(s.returns || workflow.description || ''),
    maxCredits: estimate(workflow),
    hasDynamicCost: (workflow.costEstimate?.dynamicNodeCosts?.length || 0) > 0 || (workflow.costEstimate?.usageBasedNodeCosts?.length || 0) > 0,
    inputIds: workflow.shape.inputs.map((i) => i.id),
    url: workflow.url || null,
    ownerId: workflow.owner?.userId || null,
  };
}

// Workflows the signed-in person owns: ready to publish, already published, or needing a url input first.
export function ownedWorkflows(workflows, userId) {
  return workflows
    .filter((w) => userId && w.owner?.userId === userId)
    .map((w) => ({
      id: w.id,
      label: w.label,
      description: w.description || '',
      ready: takesUrl(w),
      settings: playSettings(w),
      maxCredits: estimate(w),
      inputs: (w.shape?.inputs || []).filter((i) => i.required).map((i) => i.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Inputs to send: always url, plus page_type and page_title when the workflow declares them.
export function inputsFor(play, page) {
  const inputs = { url: page.url };
  if (play.inputIds.includes('page_type')) inputs.page_type = page.pageType;
  if (play.inputIds.includes('page_title') && page.title) inputs.page_title = page.title;
  return inputs;
}

// Merge the play settings into existing metadata; Freckle replaces the whole object on write.
export function mergedMetadata(workflowMetadata, settings) {
  return { ...(workflowMetadata || {}), [PLAY_KEY]: settings };
}

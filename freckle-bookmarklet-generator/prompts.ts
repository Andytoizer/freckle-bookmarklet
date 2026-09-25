// Prompts the page hands to a coding agent. One workflow, one webhook: the setup prompt
// builds intake + a URL classifier; each play adds a branch for one URL type.
// Prompts describe outcomes, not providers; Freckle picks the providers.

export const SITE_URL = 'https://freckle-bookmarklet.vercel.app/';

// The agent is told to hand back this link with the webhook filled in; the page reads
// the query string on load, validates it and opens step 2.
export const RETURN_URL = `${SITE_URL}?webhook=<WEBHOOK_URL>`;

export type Agent = 'claude-code' | 'codex' | 'cursor';

export interface AgentDef {
  name: string;
  mark: string;
  // Deep link that opens the app with the prompt pre-filled; undefined when the tool has none.
  link?: (prompt: string) => string;
  fallback: string;
}

export const AGENTS: Record<Agent, AgentDef> = {
  'claude-code': {
    name: 'Claude Code',
    mark: '/ds/marks/claude.svg',
    fallback: 'Prompt copied. Open a terminal, run claude, and paste.',
  },
  codex: {
    name: 'Codex',
    mark: '/ds/marks/openai.svg',
    link: p => `codex://new?prompt=${encodeURIComponent(p)}`,
    fallback: 'Opening Codex with the prompt. If nothing opens, it’s on your clipboard: run codex in a terminal and paste.',
  },
  cursor: {
    name: 'Cursor',
    mark: '/ds/marks/cursor.svg',
    link: p => `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(p)}`,
    fallback: 'Opening Cursor with the prompt. If nothing opens, it’s on your clipboard: paste it into Cursor’s agent chat.',
  },
};

export const SETUP_PROMPT = `Use Freckle to build a workflow that starts from a webhook. Name the workbook "Freckle bookmark".

Each event is one page I send from my browser with the "Send to Freckle" bookmarklet. It has a single field: url.

Build the minimum:
1. A webhook-triggered workflow that stores each url as a row in a table.
2. A Jev decision node that classifies the url into a column called type: linkedin_profile (linkedin.com/in/...), linkedin_company (linkedin.com/company/...), salesforce_record (a Salesforce record URL), hubspot_record (a HubSpot record URL), or company_website (anything else). Branch on that type with a Switch node.

Don't add enrichment yet. I'll add a branch per type next. If you write any Code node, note Freckle Code nodes have no URL global; use string matching.

Test it end to end with one real URL before you report back, then remove the test row.

When it's built, copy the webhook URL to my clipboard (pbcopy on macOS) and give me this link to click, with the webhook URL filled in:
${RETURN_URL}`;

// Appended to every copied play. Each line comes from a mistake an agent actually made while building these.
export const PLAY_RULES = `Build rules:
- Before wiring any provider node, inspect its contract in the node catalog and map every required input from a field that is actually populated at that point in the branch. A node that errors is set up wrong; fix the setup, don't work around it.
- Run each new node on a real row and check its output before wiring the next one. Don't publish a branch with a node that hasn't returned real data.
- Where Freckle offers more than one provider for a job (email, phone, mobile), build a waterfall: primary provider first, next provider only when the first returns nothing.
- Freckle Code nodes have no URL global. Parse URLs with string matching, or let Jev extract what you need.
- Only write CRM fields that were empty in a read taken right before the write. Never overwrite a value.
- Reuse an enrichment chain that already exists in this org when it fits.
- Tell me the estimated credits per URL for this branch.`;

export interface Play {
  id: string;
  marks: string[];
  title: string;
  send: string;
  get: string;
  // What people read on the card.
  prompt: string;
  // Appended on copy, followed by the webhook, so the agent knows where this goes.
  where: string;
}

const LI = '/ds/marks/linkedin.svg';
const SF = '/ds/marks/salesforce.svg';
const HS = '/ds/marks/hubspot.svg';
const WEB = '/ds/marks/website.svg';
const SN = '/ds/marks/sales-navigator.png';

export const PLAYS: Play[] = [
  {
    id: 'person',
    where: 'Add this as a branch for linkedin_profile',
    marks: [LI, SN],
    title: 'Enrich a LinkedIn profile',
    send: 'A profile or Sales Navigator lead',
    get: 'Work email, mobile, title, company',
    prompt: `Enrich the person from the LinkedIn URL: name, title, company, location. Find and verify their work email, and find a mobile number. Write all of it back to the row.`,
  },
  {
    id: 'salesforce',
    where: 'Add this as a branch for salesforce_record',
    marks: [SF],
    title: 'Enrich a Salesforce record',
    send: 'A lead, contact or company URL',
    get: 'Missing email, phone and LinkedIn filled in',
    prompt: `Pull the record ID out of the URL and read the lead or contact from Salesforce. For each empty email, phone or LinkedIn field, find it and write it back to that record. Never overwrite a field that already has a value.`,
  },
  {
    id: 'hubspot',
    where: 'Add this as a branch for hubspot_record',
    marks: [HS],
    title: 'Enrich a HubSpot record',
    send: 'A lead, contact or company URL',
    get: 'Missing email, phone and LinkedIn filled in',
    prompt: `Pull the record ID out of the URL and read the contact or company from HubSpot. Fill any empty email, phone, LinkedIn, title or company-size fields and write them back to that record. Never overwrite a field that already has a value.`,
  },
  {
    id: 'icp-contacts',
    where: 'Add this as a branch for company_website and linkedin_company',
    marks: [WEB, LI, SN],
    title: 'Find ICP contacts at a company',
    send: 'A company website or LinkedIn page',
    get: 'Up to 5 matching people, with contact info',
    prompt: `Resolve the company (domain and LinkedIn page). Find up to 5 people there who match our ICP: titles like [VP Sales, Head of RevOps, GTM Engineer], manager and above. Find and verify their work emails. Add them to a table called "Target personas" and post a one-line summary per person to Slack in [#new-accounts].`,
  },
  {
    id: 'icp-fit',
    where: 'Add this as a branch for company_website and linkedin_company',
    marks: [WEB, LI, SN],
    title: 'Score company ICP fit',
    send: 'A company website or LinkedIn page',
    get: 'A 1–10 fit score with reasons',
    prompt: `Enrich the company: industry, headcount, funding, tech stack, hiring signals. Score its fit against our ICP from 1 to 10 and write a two-sentence reason. Our ICP: [B2B SaaS, 50 to 500 employees, sells to sales or marketing teams, has a RevOps or GTM engineering function]. Write the score and reason to the row.`,
  },
  {
    id: 'posts',
    where: 'Add this as a branch for linkedin_profile and linkedin_company',
    marks: [LI, SN],
    title: 'Pull recent posts and who engaged',
    send: 'A person or company LinkedIn page',
    get: 'Last 10 posts, plus the people who liked or commented',
    prompt: `Use the Harvest API actors on Apify to pull the last 10 LinkedIn posts from the page and to scrape the people who reacted to or commented on each one. For each post capture the text and date; for each engager capture name, title, company and profile URL. Store the engagers in a table called "Engagers" and flag any who match our ICP titles: [VP Sales, Head of RevOps, GTM Engineer].`,
  },
  {
    id: 'first-touch',
    where: 'Add this to the linkedin_profile branch, after the enrichment step',
    marks: [LI, SN],
    title: 'Draft a first-touch email',
    send: 'A LinkedIn profile',
    get: 'A three-line personalized email, ready to send',
    prompt: `After enrichment, research the person and their company: recent posts, role changes, company news. Draft a three-line first-touch email in my voice that references one specific thing you found and asks for a 15-minute call. Write the draft to the row and post it to Slack in [#outbound-drafts] for review.`,
  },
  {
    id: 'lookalikes',
    where: 'Add this to the company_website branch, after the enrichment step',
    marks: [WEB, LI, SN],
    title: 'Find lookalike companies',
    send: 'A company website',
    get: '10 similar companies, scored',
    prompt: `Using the enriched company as the seed, find 10 companies that look like it: same industry, similar headcount and funding stage, similar tech stack. Score each for ICP fit from 1 to 10 and add them to a table called "Lookalikes" with domain, LinkedIn page, headcount and score.`,
  },
];

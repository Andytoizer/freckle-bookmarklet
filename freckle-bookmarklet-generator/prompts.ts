// Prompts the page hands to a coding agent. One workflow, one webhook: the setup prompt
// builds intake + a URL classifier; each play adds a branch for one URL type.

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
    mark: '',
    link: p => `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(p)}`,
    fallback: 'Opening Cursor with the prompt. If nothing opens, it’s on your clipboard: paste it into Cursor’s agent chat.',
  },
};

export const SETUP_PROMPT = `Use Freckle to build a workflow that starts from a webhook.

Each event is one page I send from my browser with the "Send to Freckle" bookmarklet. It has a single field: url.

Build the minimum:
1. A webhook-triggered workflow that stores each url as a row in a table.
2. A column that classifies the url as one of: linkedin_profile (linkedin.com/in/...), linkedin_company (linkedin.com/company/...), salesforce_record, hubspot_record, or company_website (anything else).

Don't add enrichment yet. I'll add a branch per type next.

When it's built, copy the webhook URL to my clipboard (pbcopy on macOS) and give me this link to click, with the webhook URL filled in:
${RETURN_URL}`;

export interface Play {
  id: string;
  mark: string;
  title: string;
  send: string;
  get: string;
  prompt: string;
}

export const PLAYS: Play[] = [
  {
    id: 'person',
    mark: '/ds/marks/linkedin.svg',
    title: 'LinkedIn profile or Sales Navigator lead',
    send: 'A person’s profile',
    get: 'Work email, mobile, title, company',
    prompt: `Add a branch for linkedin_profile.

Enrich the person from the LinkedIn URL: name, title, company, location. Find their work email with Findymail, fall back to LeadMagic, verify with ZeroBounce. Find a mobile number. Write all of it back to the row.`,
  },
  {
    id: 'salesforce',
    mark: '/ds/marks/salesforce.svg',
    title: 'Salesforce lead or contact',
    send: 'A record URL',
    get: 'Empty email, phone and LinkedIn fields filled in',
    prompt: `Add a branch for salesforce_record.

Pull the record ID out of the URL and read the Lead or Contact from Salesforce. For each empty email, phone or LinkedIn field, find it: LinkedIn via a person search, email via Findymail then LeadMagic (verified with ZeroBounce), phone via a mobile lookup. Write the results back to that Salesforce record. Never overwrite a field that already has a value.`,
  },
  {
    id: 'hubspot',
    mark: '/ds/marks/hubspot.svg',
    title: 'HubSpot contact or company',
    send: 'A record URL',
    get: 'The record enriched in place',
    prompt: `Add a branch for hubspot_record.

Pull the record ID out of the URL and read the contact or company from HubSpot. Fill any empty email, phone, LinkedIn, title, or company-size fields using Findymail, LeadMagic, ZeroBounce and a company enrichment. Write the results back to that HubSpot record. Never overwrite a field that already has a value.`,
  },
  {
    id: 'company',
    mark: '/ds/logos/stamp_black_full.svg',
    title: 'Company website or LinkedIn company page',
    send: 'A company',
    get: 'Up to 5 ICP people there, with contact info',
    prompt: `Add a branch for company_website and linkedin_company.

Resolve the company (domain and LinkedIn page). Find up to 5 people there who match our ICP: titles like [VP Sales, Head of RevOps, GTM Engineer], manager and above. Find work emails with Findymail then LeadMagic, verified with ZeroBounce. Add them to a table called "Target personas" and post a one-line summary per person to Slack in [#new-accounts].`,
  },
];

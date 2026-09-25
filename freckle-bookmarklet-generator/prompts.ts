// Prompts the page hands to a coding agent. One workflow, one webhook: the setup prompt
// builds intake + a URL classifier; each play adds a branch for one URL type.
// Prompts describe outcomes, not providers; Freckle picks the providers.

export const SITE_URL = 'https://freckle-bookmarklet.vercel.app/';

// The agent is told to hand back this link with the webhook filled in; the page reads
// the query string on load, validates it and opens step 2.
export const RETURN_URL = `${SITE_URL}?webhook=<WEBHOOK_URL>`;
export const RULES_URL = `${SITE_URL}rules`;

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

export const SETUP_URL = `${SITE_URL}setup`;

export const DEFAULT_NAME = 'Send to Freckle';
export const WEBHOOK_RE = /^https:\/\/next-api\.freckle\.io\/v2\/dataset-webhooks\/[^/\s]+\/[^/\s]+$/i;

// Teammate link: a page with only the bookmark to drag in. The webhook rides along in the query string.
export const installUrl = (webhook: string, name: string): string =>
  `${SITE_URL}install?webhook=${encodeURIComponent(webhook)}&name=${encodeURIComponent(name)}`;


export const SETUP_PROMPT = `Set up the Freckle bookmark workflow for me.

Follow ${SETUP_URL} exactly, step by step, using the Freckle CLI. The workflow itself is already written and validated; you're creating the workbook, the webhook, and the connection, then testing it.

When it's done, copy the webhook URL to my clipboard and hand back exactly what the last step says: the link to ${SITE_URL} with the webhook filled in, labelled as my next step. That link is where I install the bookmark; the setup isn't finished until I've opened it.`;

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
const INSTANTLY = '/ds/marks/instantly.png';
const HEYREACH = '/ds/marks/heyreach.jpg';
const LEMLIST = '/ds/marks/lemlist.png';

export const PLAYS: Play[] = [
  {
    id: 'person',
    where: 'Add this as a branch for linkedin_profile',
    marks: [LI, SN],
    title: 'Enrich a LinkedIn profile',
    send: 'A profile or Sales Navigator lead',
    get: 'Work email, mobile, title, company',
    prompt: `Use Freckle to enrich the person from the LinkedIn URL: name, title, company, location. Find and verify their work email, and find a mobile number. Write all of it back to the row.`,
  },
  {
    id: 'salesforce',
    where: 'Add this as a branch for salesforce_record',
    marks: [SF],
    title: 'Enrich a Salesforce record',
    send: 'A lead, contact or company URL',
    get: 'Missing email, phone and LinkedIn filled in',
    prompt: `Use Freckle to pull the record ID out of the URL and read the lead or contact from Salesforce. For each empty email, phone or LinkedIn field, find it and write it back to that record. Never overwrite a field that already has a value.`,
  },
  {
    id: 'hubspot',
    where: 'Add this as a branch for hubspot_record',
    marks: [HS],
    title: 'Enrich a HubSpot record',
    send: 'A lead, contact or company URL',
    get: 'Missing email, phone and LinkedIn filled in',
    prompt: `Use Freckle to pull the record ID out of the URL and read the contact or company from HubSpot. Fill any empty email, phone, LinkedIn, title or company-size fields and write them back to that record. Never overwrite a field that already has a value.`,
  },
  {
    id: 'email',
    where: 'Add this as a branch for linkedin_profile, salesforce_record and hubspot_record',
    marks: [LI, SN, SF, HS],
    title: 'Find a contact\u2019s email',
    send: 'A LinkedIn profile, Sales Navigator lead, or CRM record',
    get: 'A verified work email',
    prompt: `Use Freckle to find and verify a work email for the contact. Resolve the person first: from the profile for a LinkedIn or Sales Navigator URL, from the record for a Salesforce or HubSpot URL. Write the email to the row. If it came from a CRM record, also write it to that record's email field, only if the field is empty.`,
  },
  {
    id: 'mobile',
    where: 'Add this as a branch for linkedin_profile, salesforce_record and hubspot_record',
    marks: [LI, SN, SF, HS],
    title: 'Find a contact\u2019s mobile phone',
    send: 'A LinkedIn profile, Sales Navigator lead, or CRM record',
    get: 'A mobile number',
    prompt: `Use Freckle to find a mobile phone number for the contact. Resolve the person first: from the profile for a LinkedIn or Sales Navigator URL, from the record for a Salesforce or HubSpot URL. Write the number to the row. If it came from a CRM record, also write it to that record's mobile field, only if the field is empty.`,
  },
  {
    id: 'email-mobile',
    where: 'Add this as a branch for linkedin_profile, salesforce_record and hubspot_record',
    marks: [LI, SN, SF, HS],
    title: 'Find a contact\u2019s email and mobile',
    send: 'A LinkedIn profile, Sales Navigator lead, or CRM record',
    get: 'A verified work email and a mobile number',
    prompt: `Use Freckle to find and verify a work email and find a mobile phone number for the contact. Resolve the person first: from the profile for a LinkedIn or Sales Navigator URL, from the record for a Salesforce or HubSpot URL. Write both to the row. If they came from a CRM record, also write them to that record's email and mobile fields, only where those fields are empty.`,
  },
  {
    id: 'enroll',
    where: 'Add this as a branch for linkedin_profile, salesforce_record and hubspot_record',
    marks: [LI, SN, SF, HS, INSTANTLY, HEYREACH, LEMLIST],
    title: 'Enroll a contact in an outbound sequence',
    send: 'A LinkedIn profile, Sales Navigator lead, or CRM record',
    get: 'The person added to a sequence in your outreach tool',
    prompt: `Use Freckle to enroll the contact in an outbound sequence in [Instantly / HeyReach / Lemlist: pick one]. Resolve the person first: from the profile for a LinkedIn or Sales Navigator URL, from the record for a Salesforce or HubSpot URL. Find and verify a work email if the tool needs one, then add them to the sequence called [sequence name]. Write the tool, the sequence and the enrollment status to the row. If I haven't replaced the bracketed choices above, stop and ask me which outreach tool and which sequence before you build anything.`,
  },
  {
    id: 'icp-contacts',
    where: 'Add this as a branch for company_website and linkedin_company',
    marks: [WEB, LI, SN],
    title: 'Find ICP contacts at a company',
    send: 'A company website or LinkedIn page',
    get: 'Up to 5 matching people, with contact info',
    prompt: `Use Freckle to resolve the company (domain and LinkedIn page). Find up to 5 people there who match our ICP: titles like [VP Sales, Head of RevOps, GTM Engineer], manager and above. Find and verify their work emails. Add them to a table called "Target personas" and post a one-line summary per person to Slack in [#new-accounts].`,
  },
  {
    id: 'icp-fit',
    where: 'Add this as a branch for company_website and linkedin_company',
    marks: [WEB, LI, SN],
    title: 'Score company ICP fit',
    send: 'A company website or LinkedIn page',
    get: 'A 1–10 fit score with reasons',
    prompt: `Use Freckle to enrich the company: industry, headcount, funding, tech stack, hiring signals. Score its fit against our ICP from 1 to 10 and write a two-sentence reason. Our ICP: [B2B SaaS, 50 to 500 employees, sells to sales or marketing teams, has a RevOps or GTM engineering function]. Write the score and reason to the row.`,
  },
  {
    id: 'posts',
    where: 'Add this as a branch for linkedin_profile and linkedin_company',
    marks: [LI, SN],
    title: 'Pull recent posts and who engaged',
    send: 'A person or company LinkedIn page',
    get: 'Last 10 posts, plus the people who liked or commented',
    prompt: `Use Freckle, with the Harvest API actors on Apify, to pull the last 10 LinkedIn posts from the page and to scrape the people who reacted to or commented on each one. For each post capture the text and date; for each engager capture name, title, company and profile URL. Store the engagers in a table called "Engagers" and flag any who match our ICP titles: [VP Sales, Head of RevOps, GTM Engineer].`,
  },
  {
    id: 'first-touch',
    where: 'Add this to the linkedin_profile branch, after the enrichment step',
    marks: [LI, SN],
    title: 'Draft a first-touch email',
    send: 'A LinkedIn profile',
    get: 'A three-line personalized email, ready to send',
    prompt: `Use Freckle to research the person and their company after enrichment: recent posts, role changes, company news. Draft a three-line first-touch email in my voice that references one specific thing you found and asks for a 15-minute call. Write the draft to the row and post it to Slack in [#outbound-drafts] for review.`,
  },
  {
    id: 'lookalikes',
    where: 'Add this to the company_website branch, after the enrichment step',
    marks: [WEB, LI, SN],
    title: 'Find lookalike companies',
    send: 'A company website',
    get: '10 similar companies, scored',
    prompt: `Use Freckle to find 10 companies that look like the enriched company: same industry, similar headcount and funding stage, similar tech stack. Score each for ICP fit from 1 to 10 and add them to a table called "Lookalikes" with domain, LinkedIn page, headcount and score.`,
  },
];

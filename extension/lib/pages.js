// What kind of page is this, and which URL should Freckle get for it.

export const PAGE_TYPES = {
  linkedin_profile: { label: 'LinkedIn profile', marks: ['linkedin.svg'] },
  linkedin_company: { label: 'LinkedIn company', marks: ['linkedin.svg'] },
  hubspot_record: { label: 'HubSpot record', marks: ['hubspot.svg'] },
  salesforce_record: { label: 'Salesforce record', marks: ['salesforce.svg'] },
  website: { label: 'Website', marks: ['website.svg'] },
};

export function classify(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (/(^|\.)linkedin\.com$/.test(host)) {
    if (/^\/(in|sales\/lead|sales\/people|talent\/profile)\//.test(path)) return 'linkedin_profile';
    if (/^\/(company|sales\/company|school)\//.test(path)) return 'linkedin_company';
    return 'website';
  }
  if (/(^|\.)hubspot\.com$/.test(host) && host.startsWith('app')) return 'hubspot_record';
  if (/\.(lightning\.force\.com|my\.salesforce\.com|salesforce\.com)$/.test(host)) return 'salesforce_record';
  return 'website';
}

export function isSalesNavLead(rawUrl) {
  return /linkedin\.com\/sales\/(lead|people)\//.test(rawUrl);
}

// Clean URLs so the same profile always arrives the same way.
export function normalize(rawUrl) {
  const u = new URL(rawUrl);
  if (/(^|\.)linkedin\.com$/.test(u.hostname)) {
    const m = u.pathname.match(/^\/(in|company|school)\/([^/]+)/);
    if (m) return `https://www.linkedin.com/${m[1]}/${m[2]}`;
  }
  u.hash = '';
  return u.toString();
}

// Injected into a Sales Navigator lead page. Must be self-contained.
// Reads the regular linkedin.com/in/ link if it's on the page; otherwise opens
// the "..." menu for up to 2 seconds to read "View LinkedIn profile", then closes it.
export async function extractSalesNavProfile() {
  const find = () => {
    const a = document.querySelector('a[href*="linkedin.com/in/"]');
    return a ? a.href.split('?')[0].replace(/\/$/, '') : null;
  };
  let url = find();
  if (url) return { url, via: 'page' };
  const btn = document.querySelector('[data-x--lead-actions-bar-overflow-menu],button[aria-label="Open actions overflow menu"]');
  if (!btn) return { url: null, via: 'none' };
  btn.click();
  for (let i = 0; i < 20 && !url; i++) {
    await new Promise((r) => setTimeout(r, 100));
    url = find();
  }
  btn.click();
  return { url, via: url ? 'menu' : 'none' };
}

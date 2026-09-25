# Send to Freckle — Chrome extension (developer build)

A Chrome side panel that sends the page you're on to one of your organization's Freckle workflows.

## Load it

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `extension` folder.
3. Pin it: puzzle piece next to the address bar → pin **Send to Freckle**.
4. Click the icon to open the side panel, then **Sign in with Freckle** and approve in the tab that opens.

After editing any file, click the reload arrow on the extension's card in `chrome://extensions`.

## How it ties to Freckle

- **Sign-in** uses the same browser approval as `freckle login`. The extension gets a Freckle CLI token, keeps it in Chrome's local extension storage, and sends it in the `X-Api-Key` header with an `x-org-id` header.
- **Workflows are found automatically.** Nothing to set up. A workflow appears in the dropdown when its intake dataset (feeds a workflow, isn't another workflow's output) has a webhook source keyed on a URL field like `/url` or `/linkedin_url`, or a webhook with no key on a dataset that has a URL field. Webhooks keyed on anything else, like an integration's `/reference_id`, are left out. Logic lives in `lib/discover.js`.
- **The field decides which pages it's offered on.** `/url` takes any page. `linkedin` fields take LinkedIn profiles (or company pages if the name says company). `website` and `domain` fields take websites, and `domain` fields get the bare hostname. `hubspot` and `salesforce` fields take those records.
- **Hiding** is per person, from the gear icon. Uncheck a workflow to drop it from your own dropdown.
- **Sending** adds a row to the target dataset through Freckle's API, the same call as `freckle workbook dataset entry create`. No webhook URL is involved. If the dataset's workflow connection is set to **auto**, it runs on every send; if it's **manual**, rows wait. The panel shows which.


## Using it

- Each kind of page remembers the last workflow you picked, so after the first time it's one click.
- `Alt+Shift+F` (`⌥⇧F` on Mac) sends the current page to its default without the panel. The icon badge shows ✓ or !. Change the shortcut at `chrome://extensions/shortcuts`.
- Sales Navigator leads are sent as the person's regular `linkedin.com/in/` URL. If the link isn't on the page, the extension opens the lead's "…" menu for up to 2 seconds to read it, then closes it.

## Permissions

- Always: side panel, storage, `activeTab`, `scripting`, and `next-api.freckle.io`.
- Asked for in the panel the first time: `tabs` (to see which page you're on) and `linkedin.com` (to read Sales Navigator leads). Without them, the keyboard shortcut still works.

## Files

- `manifest.json` — permissions, side panel, shortcut
- `background.js` — opens the panel from the icon, handles the shortcut
- `sidepanel.html` / `sidepanel.js` — the panel UI
- `lib/freckle.js` — Freckle API client (sign-in, workbooks, datasets, entries)
- `lib/discover.js` — finds sendable workflows in the org's workbooks
- `lib/core.js` — shared send logic, per-page-type defaults, hidden workflows, recent sends
- `lib/pages.js` — page-type detection, URL cleanup, the Sales Navigator reader
- `lib/icons.js`, `assets/`, `styles/tokens.css` — Freckle design system assets; the icon is freckle.io's gradient stamp

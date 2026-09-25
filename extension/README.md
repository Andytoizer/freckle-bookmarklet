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
- **Reps see plays, nothing else.** A play is a saved Freckle workflow that:
  - takes a required string input `url` (optional `page_type` and `page_title`; no other required inputs), and
  - has `repPlay` in its metadata: `{ "enabled": true, "name": "Find email and mobile", "pages": ["linkedin_profile"], "returns": "Work email and mobile, added to HubSpot" }`. An empty `pages` list means any page.
  Workflows that don't meet both are invisible to the extension. Logic lives in `lib/plays.js`.
- **Running a play** starts the workflow through Freckle's API, the same call the Rep MCP's `run_workflow` makes. The run carries `source: chrome-extension`, the rep's email and the page title in its run metadata. The panel follows the run and shows its outputs and the credits it used.
- **Publishing** happens two ways. Operators use the `freckle-play` skill in Claude Code or Codex. Or a workflow's owner flips "Available to reps" in the panel's settings, where they can also pick page types. The extension merges the flag into the workflow's existing metadata, because Freckle replaces the whole metadata object on update, then reads it back to confirm.
- **Hiding** is per person, from settings. Uncheck a play to drop it from your own dropdown.

## Using it

- Each kind of page remembers the last play you picked, so after the first time it's one click.
- `Alt+Shift+F` (`⌥⇧F` on Mac) runs the default play for the current page without the panel. The icon badge shows … while it runs, then ✓ or !. Change the shortcut at `chrome://extensions/shortcuts`.
- Sales Navigator leads are sent as the person's regular `linkedin.com/in/` URL. If the link isn't on the page, the extension opens the lead's "…" menu for up to 2 seconds to read it, then closes it.

## Permissions

- Always: side panel, storage, `activeTab`, `scripting`, and `next-api.freckle.io`.
- Asked for in the panel the first time: `tabs` (to see which page you're on) and `linkedin.com` (to read Sales Navigator leads). Without them, the keyboard shortcut still works.

## Files

- `manifest.json` — permissions, side panel, shortcut
- `background.js` — opens the panel from the icon, handles the shortcut
- `sidepanel.html` / `sidepanel.js` — the panel UI
- `lib/freckle.js` — Freckle API client (sign-in, workflows, runs, metadata)
- `lib/plays.js` — the play contract: which workflows qualify and what inputs they get
- `lib/core.js` — running and following plays, publishing, per-page-type defaults, recent runs
- `lib/pages.js` — page-type detection, URL cleanup, the Sales Navigator reader
- `lib/icons.js`, `assets/`, `styles/tokens.css` — Freckle design system assets; the icon is freckle.io's gradient stamp

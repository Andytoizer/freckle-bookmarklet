# Freckle bookmark setup

Everything one Send to Freckle bookmark needs on the Freckle side, built in about 15 seconds instead of designed from scratch by an agent:

- a workbook with a dataset **Bookmarked pages** keyed on `url`
- its own webhook on that dataset (the URL the bookmark sends to)
- a router workflow from `freckle-bookmark.yaml`: a Jev decision node that classifies each URL as `linkedin_profile`, `linkedin_company`, `hubspot_record`, `salesforce_record` or `company_website`, and a Switch with one empty branch per type
- a connection from the dataset to the router, set to run on every new row

Plays are added later as branches under the matching Switch case.

## Run it

Needs the [Freckle CLI](https://github.com/freckle-io/agent-plugins), signed in with `freckle login`.

```bash
bash setup.sh                                   # "Freckle bookmark", active org
bash setup.sh --name "SDR team bookmark"        # any name
bash setup.sh --org-id org_…                    # a specific org
```

**Every run creates a new, separate set with its own webhook.** Run it once per bookmark you want: one per rep, one per team, one per use, whatever fits. Nothing is shared between runs.

It prints the workbook link, the webhook URL (also copied to the clipboard on macOS), and the link back to the bookmarklet page with the webhook filled in. It sends one test row through the webhook, confirms Freckle accepted it, then deletes it. Nothing here consumes credits; the classifier is Freckle's free decision agent.

The webhook URL is saved in a dot-file next to the script, because Freckle only shows it at creation. If you lose it, rotate the secret: `freckle workbook dataset webhook rotate <workbook-id> <source-id>`.

## For agents

The setup prompt on the bookmarklet page should tell the agent to fetch and run this rather than build the workbook itself:

```
curl -fsSL https://freckle-bookmarklet.vercel.app/setup/setup.sh -o setup.sh
curl -fsSL https://freckle-bookmarklet.vercel.app/setup/freckle-bookmark.yaml -o freckle-bookmark.yaml
curl -fsSL https://freckle-bookmarklet.vercel.app/setup/catalog.json -o catalog.json
bash setup.sh --name "<what this bookmark is for>"
```

Then extend the router: add nodes under the Switch case for the page type the play handles, validate with `freckle workflow draft validate`, and publish with `freckle workflow saved lifecycle publish <workflow-id> --file freckle-bookmark.yaml`.

## Files

- `setup.sh` — the steps; each run creates a fresh set
- `freckle-bookmark.yaml` — the router draft, validated against Freckle's compiler
- `catalog.json` — declares the dataset's `url` field so the connection can be created before any row arrives

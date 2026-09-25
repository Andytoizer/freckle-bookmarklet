# Freckle bookmark setup

Everything the Send to Freckle bookmarklet needs on the Freckle side, built in about 15 seconds instead of designed from scratch by an agent:

- a workbook **Freckle bookmark** with a dataset **Bookmarked pages** keyed on `url`
- a webhook on that dataset (the URL the bookmarklet sends to)
- the **Freckle bookmark router** workflow from `freckle-bookmark.yaml`: a Jev decision node that classifies each URL as `linkedin_profile`, `linkedin_company`, `hubspot_record`, `salesforce_record` or `company_website`, and a Switch with one empty branch per type
- a connection from the dataset to the router, set to run on every new row

Plays are added later as branches under the matching Switch case.

## Run it

Needs the [Freckle CLI](https://github.com/freckle-io/agent-plugins), signed in with `freckle login`.

```bash
bash setup.sh                    # active org
bash setup.sh --org-id org_…     # a specific org
```

It prints the workbook link, the webhook URL (also copied to the clipboard on macOS), and the link back to the bookmarklet page with the webhook filled in. It sends one test row through the webhook, waits for Freckle to accept it, then deletes it. Nothing here consumes credits; the classifier is Freckle's free decision agent.

Rerunning is safe. Each step is skipped when the thing already exists by name. The webhook URL is saved in a dot-file next to the script because Freckle only shows it on creation; if that file is missing, the script rotates the secret to get a new URL and says so.

## For agents

The setup prompt on the bookmarklet page should tell the agent to fetch and run this rather than build the workbook itself:

```
curl -fsSL https://raw.githubusercontent.com/Andytoizer/freckle-bookmarklet/main/setup/setup.sh -o setup.sh
curl -fsSL https://raw.githubusercontent.com/Andytoizer/freckle-bookmarklet/main/setup/freckle-bookmark.yaml -o freckle-bookmark.yaml
curl -fsSL https://raw.githubusercontent.com/Andytoizer/freckle-bookmarklet/main/setup/catalog.json -o catalog.json
bash setup.sh
```

Then extend the router: add nodes under the Switch case for the page type the play handles, validate with `freckle workflow draft validate`, and publish with `freckle workflow saved lifecycle publish <workflow-id> --file freckle-bookmark.yaml`.

## Files

- `setup.sh` — the steps, idempotent
- `freckle-bookmark.yaml` — the router draft, validated against Freckle's compiler
- `catalog.json` — declares the dataset's `url` field so the connection can be created before any row arrives

# Setting up the Freckle bookmark workflow

Exact steps for a coding agent. Run them in order with the Freckle CLI. Don't design anything; the workflow is already written and validated. Every run of these steps creates its own workbook and its own webhook URL, so a person can set up as many as they like.

Read https://freckle-bookmarklet.vercel.app/rules first.

## 0. Pick the org

Run `freckle whoami`. If the CLI has access to more than one organization, ask the user which one to use and pass `--org-id <org-id>` on every command below.

## 1. Workbook and input dataset

```bash
freckle workbook create --label "Freckle bookmark" --description "Pages sent from the Send to Freckle bookmark, routed by page type." --json
# keep workbook.id as WB

freckle workbook dataset create WB --label "Bookmarked pages" --description "One row per URL sent from the bookmark." --json
# keep dataset.id as DS
```

Give the dataset its one field. Write `catalog.json`:

```json
[{ "id": "url", "path": "/url", "label": "URL", "type": "string", "visible": true, "order": 0 }]
```

```bash
freckle workbook dataset catalog replace WB DS --file catalog.json
```

## 2. Webhook

```bash
freckle workbook dataset webhook create WB DS --key-path /url --json
# keep endpointUrl as WEBHOOK. It is unique to this dataset; treat it as a secret.
```

The bookmark posts `{"url": "<page url>"}` to it. The URL is the row key, so sending the same page again updates its row.

## 3. Workflow

```bash
curl -fsSL https://freckle-bookmarklet.vercel.app/freckle-bookmark.yaml -o freckle-bookmark.yaml
freckle workflow draft validate --file freckle-bookmark.yaml
```

If validation reports that the slug `freckle-bookmark` already exists in this org, change `workflowId` in the file to `freckle-bookmark-2` (or the next free number) and validate again. Don't change anything else in the file.

```bash
freckle workflow saved create --file freckle-bookmark.yaml --label "Freckle bookmark" --description "Classifies each bookmarked URL and routes it by type." --json
# keep workflow.id as WF
```

## 4. Connect the dataset to the workflow

Write `mapping.json`:

```json
{ "url": { "kind": "field", "fieldId": "url" } }
```

```bash
freckle workbook dataset connection create WB DS WF --file mapping.json --output-label "Routed pages" --trigger-policy auto --json
# keep connection.id as CONN
```

## 5. Test it end to end

```bash
curl -s -X POST "WEBHOOK" -H "Content-Type: application/json" -d '{"url":"https://www.linkedin.com/company/microsoft/"}'
freckle workbook dataset connection runs WB CONN --limit 5
```

Wait for the run to show `completed`, then confirm the output dataset row has `type` = `linkedin_company`. If the run failed, read its failure detail, fix the cause, and rerun until it completes. Then delete the test entry from the input dataset (`freckle workbook dataset entry list WB DS` to find it, `freckle workbook dataset entry delete WB DS <entry-id>` to remove it).

## 6. Hand back

Copy WEBHOOK to the clipboard: `printf '%s' "WEBHOOK" | pbcopy` (macOS).

Then end your message with this, word for word, filling in the two links. The person is not finished when you are: they still have to install the bookmark, and that happens on the link. Don't describe the setup as complete or add other suggestions after it.

```
The workflow is built and tested. One more step, and it's not done until you do it:

**Next: open this link to install the bookmark.** It walks you through dragging it into your bookmarks bar, then shows the plays you can add.
https://freckle-bookmarklet.vercel.app/?webhook=<WEBHOOK URL-encoded>

Your workbook: <workbook link>
```

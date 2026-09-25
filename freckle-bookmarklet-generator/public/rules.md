# Building the Freckle bookmark workflow

Rules for a coding agent building or extending the Freckle bookmark workflow. Follow every rule below.

## 1. The workflow

1. The workbook is named "Freckle bookmark". There is one workflow in it, triggered by a webhook. Every event has a single field, `url`, which is also the row key: sending the same URL again updates its row.
2. A Jev decision node classifies each URL into a column called `type`: `linkedin_profile`, `linkedin_company`, `salesforce_record`, `hubspot_record`, or `company_website`. A Switch node branches on it.
3. Each play adds one branch under the matching Switch case. Never change the webhook, the input field, the classifier or the other branches while adding one.
4. If the workflow already exists in the org, extend it. Don't create a second one.

## 2. Adding a branch

1. Before wiring any provider node, inspect its contract in the node catalog and map every required input from a field that is actually populated at that point in the branch. A node that errors is set up wrong. Fix the setup; don't work around it.
2. Run each new node on a real row and check its output before wiring the next one. Don't publish a branch with a node that hasn't returned real data.
3. Where Freckle offers more than one provider for a job (email, phone, mobile), build a waterfall: primary provider first, next provider only when the first returns nothing.
4. Freckle Code nodes have no `URL` global. Parse URLs with string matching, or let Jev extract what you need.
5. Only write CRM fields that were empty in a read taken right before the write. Never overwrite a value that already exists.
6. Reuse an enrichment chain that already exists in this org when it fits, rather than building a parallel one.
7. Freckle picks the data providers. Don't ask which to use unless the catalog offers nothing for the job.

## 3. Testing before you report back

1. Send one real URL of the branch's type through the webhook and run it end to end.
2. Confirm the run completed and the row has the new fields filled in. For CRM branches, read the record again and confirm the writes landed and existing values were untouched.
3. If anything fails, the setup is wrong. Fix it and rerun until it completes cleanly.
4. Remove any test rows you created.

## 4. What to say when you're done

1. What the branch does, in one or two sentences, and a link to the workbook.
2. The URL you tested with and what it produced.
3. The estimated credits per URL for this branch.
4. For the initial build only: copy the webhook URL to the clipboard (`pbcopy` on macOS) and give back `https://freckle-bookmarklet.vercel.app/?webhook=<WEBHOOK_URL>` with the URL filled in.

#!/usr/bin/env bash
# Sets up the Freckle bookmark workbook exactly as the Send to Freckle bookmarklet expects.
# Idempotent by name: rerunning in an org that already has the workbook just prints its webhook.
#
#   bash setup.sh [--org-id ORG]
#
# Needs the Freckle CLI, signed in (freckle login). Nothing here consumes credits.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORG=""; [ "${1:-}" = "--org-id" ] && ORG="--org-id=$2"
SITE="https://freckle-bookmarklet.vercel.app"
WB_LABEL="Freckle bookmark"; DS_LABEL="Bookmarked pages"; WF_LABEL="Freckle bookmark router"

command -v freckle >/dev/null || { echo "freckle CLI not found. Install: https://github.com/freckle-io/agent-plugins"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
freckle whoami $ORG >/dev/null || { echo "Not signed in. Run: freckle login"; exit 1; }
j() { python3 -c "import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }

# 1. Workbook (reuse by name)
WID=$(freckle workbook list --json $ORG | j "next((w['id'] for w in d['workbooks'] if w['label']=='$WB_LABEL'), '')")
if [ -z "$WID" ]; then
  WID=$(freckle workbook create --label "$WB_LABEL" --description "Pages sent from the Send to Freckle bookmarklet, classified by type and routed to plays." --json $ORG | j "d['workbook']['id']")
  echo "Created workbook $WID"
else
  echo "Workbook exists: $WID"
fi

# 2. Intake dataset with a declared url field, so the connection can map to it before any row arrives
DID=$(freckle workbook dataset list "$WID" --json $ORG | j "next((x['id'] for x in d['datasets'] if x['label']=='$DS_LABEL'), '')")
if [ -z "$DID" ]; then
  DID=$(freckle workbook dataset create "$WID" --label "$DS_LABEL" --description "One row per page a rep sent. url is the key: sending the same page again updates its row." --json $ORG | j "d['dataset']['id']")
  freckle workbook dataset catalog replace "$WID" "$DID" --file "$HERE/catalog.json" $ORG >/dev/null
  echo "Created dataset $DID"
else
  echo "Dataset exists: $DID"
fi

# 3. Webhook keyed on /url. Freckle shows the URL only when it's created or rotated, so it's saved
#    next to this script. The CLI returns a path; prefix the API host.
API=$(freckle config api-base-url $ORG)
full() { case "$1" in /*) echo "$API$1";; *) echo "$1";; esac; }
HOOK_FILE="$HERE/.webhook-$DID"
HOOK=$(full "$(cat "$HOOK_FILE" 2>/dev/null || true)")
if [ -z "$HOOK" ]; then
  SRC=$(freckle workbook dataset source list "$WID" "$DID" --json $ORG | j "next((s['id'] for s in d['sources'] if s['kind']=='webhook'), '')")
  if [ -n "$SRC" ]; then
    HOOK=$(full "$(freckle workbook dataset webhook rotate "$WID" "$SRC" --json $ORG | j "d['endpointUrl']")")
    echo "Webhook existed without a saved URL; rotated it. Any bookmark using the old URL needs the new one."
  else
    HOOK=$(full "$(freckle workbook dataset webhook create "$WID" "$DID" --key-path /url --json $ORG | j "d['endpointUrl']")")
    echo "Created webhook"
  fi
  printf '%s' "$HOOK" > "$HOOK_FILE"; chmod 600 "$HOOK_FILE"
fi

# 4. Router workflow from the shipped draft
WF_KEY="freckle-bookmark-router"   # workflowId in the draft; unique per org, even across archived workflows
WFID=$(freckle workflow saved list --json $ORG | j "next((w['id'] for w in (d if isinstance(d,list) else d['workflows']) if w.get('workflowKey')=='$WF_KEY' or w['label']=='$WF_LABEL'), '')")
if [ -z "$WFID" ]; then
  OLD=$(freckle workflow saved list --archived --json $ORG | j "next((w['id'] for w in (d if isinstance(d,list) else d['workflows']) if w.get('workflowKey')=='$WF_KEY'), '')")
  if [ -n "$OLD" ]; then
    freckle workflow saved unarchive "$OLD" $ORG >/dev/null; WFID="$OLD"; echo "Restored archived workflow $WFID"
  fi
fi
if [ -z "$WFID" ]; then
  freckle workflow draft validate --file "$HERE/freckle-bookmark.yaml" $ORG >/dev/null
  WFID=$(freckle workflow saved create --file "$HERE/freckle-bookmark.yaml" --label "$WF_LABEL" --description "Classifies each bookmarked page (LinkedIn profile, LinkedIn company, HubSpot, Salesforce, website) and routes it. Plays are added as branches." --json $ORG | j "d['workflow']['id']")
  echo "Created workflow $WFID"
else
  echo "Workflow exists: $WFID"
fi

# 5. Connect dataset → workflow, run on every new row
CONN=$(freckle workbook list --json $ORG | j "next((c['id'] for w in d['workbooks'] if w['id']=='$WID' for c in w['connections'] if c['inputDatasetId']=='$DID' and c['workflowId']=='$WFID'), '')")
if [ -z "$CONN" ]; then
  CONN=$(freckle workbook dataset connection create "$WID" "$DID" "$WFID" --input-json '{"url":{"kind":"field","fieldId":"url"}}' --output-label "Routed pages" --trigger-policy auto --json $ORG | j "d['connection']['id']")
  echo "Connected, trigger: auto ($CONN)"
else
  echo "Connection exists: $CONN"
fi

# 6. Prove it: one real send through the webhook
RESP=$(curl -sS -X POST "$HOOK" -H 'content-type: application/json' -d '{"url":"https://www.linkedin.com/in/freckle-setup-check"}')
echo "$RESP" | grep -q '"acceptedCount":1' || { echo "Webhook test failed: $RESP"; exit 3; }
echo "Webhook accepted a test row; the router runs on it automatically."
# Remove the test row again (deletion is asynchronous on Freckle's side).
TEST_ENTRY=$(freckle workbook dataset entry list "$WID" "$DID" --json $ORG | j "next((e['id'] for e in d['entries'] if e.get('value',{}).get('url')=='https://www.linkedin.com/in/freckle-setup-check'), '')")
[ -n "$TEST_ENTRY" ] && freckle workbook dataset entry delete "$WID" "$DID" "$TEST_ENTRY" $ORG >/dev/null && echo "Removed the test row."

WBURL=$(freckle workbook list --json $ORG | j "next((w.get('url','') for w in d['workbooks'] if w['id']=='$WID'), '')")
echo
echo "Workbook:  $WBURL"
echo "Webhook:   $HOOK"
echo "Next:      $SITE/?webhook=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$HOOK")"
if command -v pbcopy >/dev/null; then printf '%s' "$HOOK" | pbcopy; echo "(webhook URL copied to clipboard)"; fi

#!/usr/bin/env bash
# Creates a new Freckle bookmark workbook: intake dataset keyed on url, its own webhook,
# a router workflow, and an auto-run connection. Every run makes a fresh set with a unique
# webhook, so run it once per bookmark you want.
#
#   bash setup.sh [--name "Freckle bookmark"] [--org-id ORG]
#
# Needs the Freckle CLI, signed in (freckle login). Nothing here consumes credits.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="https://freckle-bookmarklet.vercel.app"
NAME="Freckle bookmark"; ORG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="$2"; shift 2;;
    --org-id) ORG="--org-id=$2"; shift 2;;
    *) echo "Unknown argument: $1"; exit 1;;
  esac
done

command -v freckle >/dev/null || { echo "freckle CLI not found. Install: https://github.com/freckle-io/agent-plugins"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
freckle whoami $ORG >/dev/null || { echo "Not signed in. Run: freckle login"; exit 1; }
j() { python3 -c "import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
API=$(freckle config api-base-url $ORG)
full() { case "$1" in /*) echo "$API$1";; *) echo "$1";; esac; }

# Unique slug for the router: Freckle keeps workflow slugs unique per org, even across archived workflows.
SUFFIX=$(python3 -c "import secrets; print(secrets.token_hex(3))")
SLUG=$(python3 -c "import re,sys; print(re.sub(r'[^a-z0-9]+','-',sys.argv[1].lower()).strip('-')[:40])" "$NAME")-router-$SUFFIX
DRAFT=$(mktemp -t freckle-bookmark).yaml
sed "s/^workflowId: .*/workflowId: $SLUG/" "$HERE/freckle-bookmark.yaml" > "$DRAFT"

# 1. Workbook
WID=$(freckle workbook create --label "$NAME" --description "Pages sent from a Send to Freckle bookmark, classified by type and routed to plays." --json $ORG | j "d['workbook']['id']")
echo "Workbook   $WID  $NAME"

# 2. Intake dataset with a declared url field, so the connection can map to it before any row arrives
DID=$(freckle workbook dataset create "$WID" --label "Bookmarked pages" --description "One row per page a rep sent. url is the key: sending the same page again updates its row." --json $ORG | j "d['dataset']['id']")
freckle workbook dataset catalog replace "$WID" "$DID" --file "$HERE/catalog.json" $ORG >/dev/null
echo "Dataset    $DID"

# 3. Webhook keyed on /url. Freckle shows the URL only now, so it's also saved next to this script.
HOOK=$(full "$(freckle workbook dataset webhook create "$WID" "$DID" --key-path /url --json $ORG | j "d['endpointUrl']")")
HOOK_FILE="$HERE/.webhook-$DID"; printf '%s' "$HOOK" > "$HOOK_FILE"; chmod 600 "$HOOK_FILE"
echo "Webhook    created (saved to $(basename "$HOOK_FILE"))"

# 4. Router workflow from the shipped draft
freckle workflow draft validate --file "$DRAFT" $ORG >/dev/null
WFID=$(freckle workflow saved create --file "$DRAFT" --label "$NAME router" --description "Classifies each bookmarked page (LinkedIn profile, LinkedIn company, HubSpot, Salesforce, website) and routes it. Plays are added as branches." --json $ORG | j "d['workflow']['id']")
rm -f "$DRAFT"
echo "Workflow   $WFID  $NAME router"

# 5. Connect dataset → workflow, run on every new row
CONN=$(freckle workbook dataset connection create "$WID" "$DID" "$WFID" --input-json '{"url":{"kind":"field","fieldId":"url"}}' --output-label "Routed pages" --trigger-policy auto --json $ORG | j "d['connection']['id']")
echo "Connection $CONN  auto"

# 6. Prove it: one real send through the webhook, then remove the test row (deletion is asynchronous).
RESP=$(curl -sS -X POST "$HOOK" -H 'content-type: application/json' -d '{"url":"https://www.linkedin.com/in/freckle-setup-check"}')
echo "$RESP" | grep -q '"acceptedCount":1' || { echo "Webhook test failed: $RESP"; exit 3; }
TEST_ENTRY=$(freckle workbook dataset entry list "$WID" "$DID" --json $ORG | j "next((e['id'] for e in d['entries'] if e.get('value',{}).get('url')=='https://www.linkedin.com/in/freckle-setup-check'), '')")
[ -n "$TEST_ENTRY" ] && freckle workbook dataset entry delete "$WID" "$DID" "$TEST_ENTRY" $ORG >/dev/null
echo "Test row   accepted, routed, removed"

WBURL=$(freckle workbook list --json $ORG | j "next((w.get('url','') for w in d['workbooks'] if w['id']=='$WID'), '')")
echo
echo "Workbook:  $WBURL"
echo "Webhook:   $HOOK"
echo "Next:      $SITE/?webhook=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$HOOK")"
if command -v pbcopy >/dev/null; then printf '%s' "$HOOK" | pbcopy; echo "(webhook URL copied to clipboard)"; fi

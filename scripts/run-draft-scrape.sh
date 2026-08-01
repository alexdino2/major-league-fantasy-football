#!/bin/bash
set -euo pipefail
cd /workspace
export CBS_LOGIN_TIMEOUT_MS="${CBS_LOGIN_TIMEOUT_MS:-3600000}"
: > /tmp/scrape-draft.log
echo "Starting scrape at $(date -Is) timeout=${CBS_LOGIN_TIMEOUT_MS}ms" | tee -a /tmp/scrape-draft.log
node scripts/scrape-draft-results.js >> /tmp/scrape-draft.log 2>&1
echo "EXIT:$?" >> /tmp/scrape-draft.log

#!/usr/bin/env bash
# Usage: ./gh_set_secrets.sh <owner/repo>
# Requires GitHub CLI (gh) and that you're authenticated
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <owner/repo>"
  exit 2
fi
REPO="$1"

# Note: docker-build-push.yml authenticates to ghcr.io with the built-in
# GITHUB_TOKEN, so no REGISTRY/REGISTRY_USERNAME/REGISTRY_PASSWORD secrets
# are needed for that workflow.
read -sp "RENDER_API_KEY (optional): " RENDER_API_KEY
echo
read -p "RENDER_SERVICE_ID (optional): " RENDER_SERVICE_ID

echo "Setting secrets on $REPO..."

if [ -n "$RENDER_API_KEY" ]; then
  echo "$RENDER_API_KEY" | gh secret set RENDER_API_KEY --repo "$REPO"
fi
if [ -n "$RENDER_SERVICE_ID" ]; then
  echo "$RENDER_SERVICE_ID" | gh secret set RENDER_SERVICE_ID --repo "$REPO"
fi

echo "Secrets set. Verify in GitHub repo Settings → Secrets & variables → Actions."

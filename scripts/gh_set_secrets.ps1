Param(
  [Parameter(Mandatory=$true)][string]$Repo
)
# Requires GitHub CLI (gh)
Write-Host "You will be prompted for secrets (empty = skip)."
# Note: docker-build-push.yml authenticates to ghcr.io with the built-in
# GITHUB_TOKEN, so no REGISTRY/REGISTRY_USERNAME/REGISTRY_PASSWORD secrets
# are needed for that workflow.
$RENDER_API_KEY = Read-Host -AsSecureString "RENDER_API_KEY (optional)"
$RENDER_SERVICE_ID = Read-Host "RENDER_SERVICE_ID (optional)"

if ($RENDER_API_KEY) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($RENDER_API_KEY)) | gh secret set RENDER_API_KEY --repo $Repo }
if ($RENDER_SERVICE_ID) { $RENDER_SERVICE_ID | gh secret set RENDER_SERVICE_ID --repo $Repo }

Write-Host "Secrets set. Verify in GitHub repo Settings -> Secrets & variables -> Actions."

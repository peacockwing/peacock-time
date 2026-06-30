Param(
  [Parameter(Mandatory=$true)][string]$Repo
)
# Requires GitHub CLI (gh)
Write-Host "You will be prompted for secrets (empty = skip)."
$REGISTRY = Read-Host "REGISTRY"
$REGISTRY_USERNAME = Read-Host "REGISTRY_USERNAME"
$REGISTRY_PASSWORD = Read-Host -AsSecureString "REGISTRY_PASSWORD"
$RENDER_API_KEY = Read-Host -AsSecureString "RENDER_API_KEY (optional)"
$RENDER_SERVICE_ID = Read-Host "RENDER_SERVICE_ID (optional)"

if ($REGISTRY) { $REGISTRY | gh secret set REGISTRY --repo $Repo }
if ($REGISTRY_USERNAME) { $REGISTRY_USERNAME | gh secret set REGISTRY_USERNAME --repo $Repo }
if ($REGISTRY_PASSWORD) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($REGISTRY_PASSWORD)) | gh secret set REGISTRY_PASSWORD --repo $Repo }
if ($RENDER_API_KEY) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($RENDER_API_KEY)) | gh secret set RENDER_API_KEY --repo $Repo }
if ($RENDER_SERVICE_ID) { $RENDER_SERVICE_ID | gh secret set RENDER_SERVICE_ID --repo $Repo }

Write-Host "Secrets set. Verify in GitHub repo Settings -> Secrets & variables -> Actions."

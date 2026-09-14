param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [string]$Region = 'us-central1',
  [Parameter(Mandatory=$true)][string]$Repository,
  [Parameter(Mandatory=$true)][string]$ImageName,
  [Parameter(Mandatory=$true)][string]$VerificationReport,
  [string]$LocalImage = 'analiza-web:cloudrun',
  [switch]$Publish
)
$ErrorActionPreference = 'Stop'
function Assert-NativeSuccess([string]$Action) { if ($LASTEXITCODE -ne 0) { throw "$Action failed with exit $LASTEXITCODE" } }
$info = (docker image inspect $LocalImage | ConvertFrom-Json)[0]
Assert-NativeSuccess 'Inspect candidate'
$sourceSha = $info.Config.Labels.'org.opencontainers.image.revision'
if ($sourceSha -notmatch '^[a-f0-9]{40}$') { throw 'Image must identify its full committed source SHA.' }
if ((git rev-parse HEAD).Trim() -ne $sourceSha) { throw 'HEAD changed since this image was built. Rebuild and repeat final-image QA before publishing.' }
git merge-base --is-ancestor $sourceSha HEAD
Assert-NativeSuccess 'Verify source commit ancestry'
$dirty = @(git status --porcelain)
Assert-NativeSuccess 'Check source state'
if ($dirty.Count -gt 0) { throw 'Publish from a clean checkout of the tested commit.' }
# Defense in depth: every image build input must match the verified commit.
git diff --quiet $sourceSha -- Dockerfile .dockerignore package.json package-lock.json apps/web packages docs/qa database/postgresql scripts/deployment
Assert-NativeSuccess 'Verify all image build inputs match the tested source commit'
$env:GCP_PROJECT_ID=$ProjectId
$env:GCP_REGION=$Region
$env:ARTIFACT_REGISTRY_REPOSITORY=$Repository
$env:IMAGE_NAME=$ImageName
$env:SOURCE_SHA=$sourceSha
node scripts/deployment/validate-build.mjs
Assert-NativeSuccess 'Validate publication identity'
$tag = (Get-Content -LiteralPath '.local/cloud-run/image-ref.txt' -Raw).Trim()
$verification = Get-Content -LiteralPath $VerificationReport -Raw | ConvertFrom-Json
if (!$verification.passed -or $verification.image -ne $info.Id -or $verification.sourceSha -ne $sourceSha) { throw 'Verification must name this exact image and source commit.' }
if ($info.Config.Labels.'org.opencontainers.image.revision' -ne $sourceSha -or $info.Config.Labels.'com.analiza.data-mode' -ne 'postgresql' -or $info.Os -ne 'linux' -or $info.Architecture -ne 'amd64') { throw 'Image provenance, mode or platform mismatch.' }
Write-Output "Reviewed destination: $tag"
if (!$Publish) { Write-Output 'PREPARED ONLY. Re-run with -Publish after destination/access/budget approval.'; return }
gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet
Assert-NativeSuccess 'Registry authentication'
docker tag $LocalImage $tag
Assert-NativeSuccess 'Tag verified image'
docker push $tag
Assert-NativeSuccess 'Push image'
$digest = (gcloud artifacts docker images describe $tag --project $ProjectId --format 'value(image_summary.digest)').Trim()
Assert-NativeSuccess 'Read registry digest'
if ($digest -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Registry did not return a verifiable digest.' }
$uri = $tag.Substring(0,$tag.LastIndexOf(':')) + '@' + $digest
@{ status='PUBLISHED'; source_sha=$sourceSha; tag=$tag; digest=$digest; uri=$uri; platform='linux/amd64'; deployed=$false } | ConvertTo-Json | Set-Content -LiteralPath '.local/cloud-run/published.json'
Write-Output $uri

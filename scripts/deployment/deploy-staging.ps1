param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]+$')][string]$ProjectId,
  [Parameter(Mandatory)][ValidatePattern('^us-central1-docker\.pkg\.dev/[a-z0-9/_-]+@sha256:[a-f0-9]{64}$')][string]$WebImage,
  [Parameter(Mandatory)][ValidatePattern('^us-central1-docker\.pkg\.dev/[a-z0-9/_-]+@sha256:[a-f0-9]{64}$')][string]$OperatorImage,
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
if (-not $WebImage.StartsWith("us-central1-docker.pkg.dev/$ProjectId/") -or -not $OperatorImage.StartsWith("us-central1-docker.pkg.dev/$ProjectId/")) {
  throw 'Both image digests must belong to the selected project.'
}
$steps = @(
  ,@('run', 'jobs', 'update', 'analiza-staging-migrate', '--image', $OperatorImage, '--region', 'us-central1', '--project', $ProjectId, '--quiet')
  ,@('run', 'jobs', 'execute', 'analiza-staging-migrate', '--wait', '--region', 'us-central1', '--project', $ProjectId, '--quiet')
  ,@('run', 'services', 'update', 'analiza-staging', '--image', $WebImage, '--region', 'us-central1', '--project', $ProjectId, '--quiet')
)
foreach ($step in $steps) {
  Write-Output ('gcloud ' + ($step -join ' '))
  if ($Execute) {
    & gcloud @step
    if ($LASTEXITCODE -ne 0) { throw 'Staging release stopped: preceding operation failed.' }
  }
}
if (-not $Execute) { Write-Output 'PLAN ONLY. Requires existing staging resources, IAM, private secrets and authorized cost before -Execute.' }

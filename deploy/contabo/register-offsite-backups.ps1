# Run as the Windows operator after publishing to GitHub. No credential contents.
$ErrorActionPreference = 'Stop'
$existing = Get-ScheduledTask -TaskName 'Analiza-Contabo-Offsite-Restic'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
Set-ScheduledTask -TaskName $existing.TaskName -Settings $settings | Out-Null

$privateKey = Join-Path $env:USERPROFILE '.ssh\tuvet-contabo-restic-password'
if (-not (Test-Path -LiteralPath $privateKey)) {
    & scp -i C:/Temp/analiza-contabo-private/operator.key -o BatchMode=yes -o StrictHostKeyChecking=yes `
        root@207.244.227.122:/etc/tuvet-backup/restic-password $privateKey
    if ($LASTEXITCODE -ne 0) { throw 'Could not transfer the private recovery key' }
}
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = New-Object System.Security.AccessControl.FileSecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner([System.Security.Principal.NTAccount]::new($identity))
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow'))
Set-Acl -LiteralPath $privateKey -AclObject $acl

$argument = $existing.Actions[0].Arguments.Replace(
    '/opt/analiza-contabo-staging/backups/restic', '/var/backups/tuvet-restic'
).Replace('OneDrive\Analiza en Casa\respaldos-cifrados', 'OneDrive\TuVet\respaldos-cifrados'
).Replace('analiza-contabo-restic-password', 'tuvet-contabo-restic-password')
if (-not $argument.Contains('/var/backups/tuvet-restic') -or
    -not $argument.Contains('OneDrive\TuVet\respaldos-cifrados') -or
    -not $argument.Contains('tuvet-contabo-restic-password')) {
    throw 'Unexpected existing action; review paths before registering TuVet backup'
}
$action = New-ScheduledTaskAction -Execute $existing.Actions[0].Execute -Argument $argument
$trigger = New-ScheduledTaskTrigger -Daily -At '07:30'
Register-ScheduledTask -TaskName 'TuVet-Contabo-Offsite-Restic' -Action $action `
    -Principal $existing.Principal -Trigger $trigger -Settings $settings `
    -Description 'Copy encrypted TuVet repository; verify every file and all restic data; keep key private.' `
    -Force | Out-Null
Write-Output 'Both encrypted offsite tasks registered with retry and battery resilience.'

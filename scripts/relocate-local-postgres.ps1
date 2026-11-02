$ErrorActionPreference = 'Stop'
$projectDirectory = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourceDirectory = Join-Path $projectDirectory '.runtime\pgdata'
$destinationDirectory = Join-Path $env:LOCALAPPDATA 'InventoryWms\postgres18\pgdata'
$postgresTools = 'C:\Program Files\PostgreSQL\18\bin'
if (Test-Path -LiteralPath $destinationDirectory) { throw 'Destination already exists; refusing to overwrite.' }
if (-not (Test-Path -LiteralPath (Join-Path $sourceDirectory 'PG_VERSION'))) { throw 'Source cluster is missing.' }
Write-Output 'Waiting for PostgreSQL to finish its clean shutdown...'
for ($attempt = 0; $attempt -lt 900; $attempt++) {
    & (Join-Path $postgresTools 'pg_ctl.exe') status -D $sourceDirectory *> $null
    if ($LASTEXITCODE -ne 0) { break }
    Start-Sleep -Seconds 2
}
& (Join-Path $postgresTools 'pg_ctl.exe') status -D $sourceDirectory *> $null
if ($LASTEXITCODE -eq 0) { throw 'Database still running; source was not moved.' }
$control = & (Join-Path $postgresTools 'pg_controldata.exe') -D $sourceDirectory
if ($LASTEXITCODE -ne 0 -or -not ($control -match 'Database cluster state:\s+shut down( in recovery)?\s*$')) {
    throw 'Cluster was not shut down cleanly; source was not moved.'
}
$sourceFiles = @(Get-ChildItem -LiteralPath $sourceDirectory -File -Recurse)
$sourceBytes = ($sourceFiles | Measure-Object Length -Sum).Sum
New-Item -ItemType Directory -Path (Split-Path -Parent $destinationDirectory) -Force | Out-Null
if ([IO.Path]::GetPathRoot($sourceDirectory) -ne [IO.Path]::GetPathRoot($destinationDirectory)) {
    throw 'This relocation requires both directories on the same local drive.'
}
Move-Item -LiteralPath $sourceDirectory -Destination $destinationDirectory
$destinationFiles = @(Get-ChildItem -LiteralPath $destinationDirectory -File -Recurse)
if ($sourceFiles.Count -ne $destinationFiles.Count -or $sourceBytes -ne ($destinationFiles | Measure-Object Length -Sum).Sum) {
    throw 'Relocated cluster inventory differs; configuration was not updated.'
}
$destinationDirectory | Set-Content -LiteralPath (Join-Path $projectDirectory '.runtime\postgres-data-path.txt') -Encoding UTF8
Write-Output "RELOCATED: $destinationDirectory ($($destinationFiles.Count) files, $sourceBytes bytes)"
& (Join-Path $PSScriptRoot 'start-local.ps1') -SkipBuild
if ($LASTEXITCODE -ne 0) { throw 'Application startup failed after relocation.' }

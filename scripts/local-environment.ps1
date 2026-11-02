$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimePath = Join-Path $projectRoot '.runtime'
$connectionFile = Join-Path $runtimePath 'development.env'
if (-not (Test-Path -LiteralPath $connectionFile)) {
    throw 'Local database configuration is missing. Configure .runtime/development.env with WMS_DATABASE before starting.'
}
$connectionLine = Get-Content -LiteralPath $connectionFile | Where-Object { $_ -match '^WMS_DATABASE=' } | Select-Object -First 1
if (-not $connectionLine) { throw 'WMS_DATABASE is missing from the local configuration.' }
$env:WMS_DATABASE = $connectionLine.Substring('WMS_DATABASE='.Length)
$env:ConnectionStrings__Wms = $env:WMS_DATABASE
$env:DOTNET_CLI_HOME = Join-Path $runtimePath 'dotnet-home'
$env:NUGET_PACKAGES = Join-Path $projectRoot '.tools\nuget'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
$dotnetPath = Join-Path $projectRoot '.tools\dotnet\dotnet.exe'
if (-not (Test-Path -LiteralPath $dotnetPath)) { $dotnetPath = (Get-Command dotnet -ErrorAction Stop).Source }
$postgresBin = 'C:\Program Files\PostgreSQL\18\bin'
$postgresData = [IO.Path]::GetFullPath((Join-Path $runtimePath 'pgdata'))
$postgresDataPathFile = Join-Path $runtimePath 'postgres-data-path.txt'
if (Test-Path -LiteralPath $postgresDataPathFile) {
    $configuredDataPath = (Get-Content -LiteralPath $postgresDataPathFile -Raw).Trim()
    if (-not [IO.Path]::IsPathRooted($configuredDataPath)) {
        throw 'postgres-data-path.txt must contain an absolute local PostgreSQL data directory.'
    }
    $postgresData = [IO.Path]::GetFullPath($configuredDataPath)
}

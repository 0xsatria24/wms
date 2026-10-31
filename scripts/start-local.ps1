param([switch]$SkipBuild)
. (Join-Path $PSScriptRoot 'local-environment.ps1')
if (-not (Test-Path -LiteralPath (Join-Path $postgresData 'PG_VERSION'))) {
    throw 'This workspace does not contain the isolated development PostgreSQL cluster.'
}
& (Join-Path $postgresBin 'pg_ctl.exe') status -D $postgresData *> $null
if ($LASTEXITCODE -ne 0) {
    $databaseProcess = Start-Process -FilePath (Join-Path $postgresBin 'postgres.exe') -ArgumentList @('-D', ('"' + $postgresData + '"'), '-h', '127.0.0.1', '-p', '55432') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'pg-stdout.log') -RedirectStandardError (Join-Path $runtimePath 'pg-stderr.log')
    $databaseProcess.Id | Set-Content -LiteralPath (Join-Path $runtimePath 'postgres.pid')
}
$databaseReady = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    & (Join-Path $postgresBin 'pg_isready.exe') -h 127.0.0.1 -p 55432 *> $null
    if ($LASTEXITCODE -eq 0) { $databaseReady = $true; break }
    Start-Sleep -Milliseconds 250
}
if (-not $databaseReady) { throw 'Development PostgreSQL did not become ready. Check .runtime/pg-stderr.log.' }
if (-not $SkipBuild) {
    & $dotnetPath build (Join-Path $projectRoot 'InventoryWms.sln') --no-restore
    if ($LASTEXITCODE -ne 0) { throw 'The .NET build failed.' }
}
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:DOTNET_ENVIRONMENT = 'Development'
$env:Development__EnableDemoAuth = 'true'
$env:Development__SeedDemo = 'true'
$env:Database__MigrateOnStartup = 'true'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5080'
function Start-ProjectProcess([string]$Name, [string]$File, [string[]]$Arguments, [int]$Port = 0) {
    $pidFile = Join-Path $runtimePath ($Name + '.pid')
    if (Test-Path -LiteralPath $pidFile) {
        $savedProcessId = [int](Get-Content -LiteralPath $pidFile)
        $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$savedProcessId" -ErrorAction SilentlyContinue
        if ($existing -and $existing.CommandLine -like ('*' + $projectRoot + '*')) {
            Write-Host "$Name already running ($savedProcessId)."
            return
        }
    }
    if ($Port -gt 0 -and (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
        throw "Port $Port is occupied by a process that this script does not manage."
    }
    $launched = Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath ($Name + '-stdout.log')) -RedirectStandardError (Join-Path $runtimePath ($Name + '-stderr.log'))
    $launched.Id | Set-Content -LiteralPath $pidFile
    Write-Host "$Name started ($($launched.Id))."
}
Start-ProjectProcess 'api' $dotnetPath @(('"' + (Join-Path $projectRoot 'backend\Wms.Api\bin\Debug\net10.0\Wms.Api.dll') + '"'), '--contentRoot', ('"' + (Join-Path $projectRoot 'backend\Wms.Api') + '"')) 5080
Start-ProjectProcess 'worker' $dotnetPath @(('"' + (Join-Path $projectRoot 'backend\Wms.Worker\bin\Debug\net10.0\Wms.Worker.dll') + '"'))
$nodePath = (Get-Command node -ErrorAction Stop).Source
$vitePath = Join-Path $projectRoot 'prototype\node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Frontend dependencies are missing. Run npm ci inside prototype.' }
Start-ProjectProcess 'web' $nodePath @(('"' + $vitePath + '"'), ('"' + (Join-Path $projectRoot 'prototype') + '"'), '--host', '127.0.0.1', '--port', '4173', '--strictPort') 4173
foreach ($endpoint in @('http://127.0.0.1:5080/health/ready', 'http://127.0.0.1:4173/')) {
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $endpoint -TimeoutSec 2 -UseBasicParsing
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw "The local endpoint $endpoint did not become ready. Check .runtime logs." }
}
Write-Host 'Preview: http://127.0.0.1:4173/ (simulation data). Logs: .runtime/.'

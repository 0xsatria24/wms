param([switch]$StopDatabase)
. (Join-Path $PSScriptRoot 'local-environment.ps1')
foreach ($name in @('web', 'worker', 'api')) {
    $pidFile = Join-Path $runtimePath ($name + '.pid')
    if (-not (Test-Path -LiteralPath $pidFile)) { continue }
    $savedProcessId = [int](Get-Content -LiteralPath $pidFile)
    $managed = Get-CimInstance Win32_Process -Filter "ProcessId=$savedProcessId" -ErrorAction SilentlyContinue
    if ($managed -and $managed.CommandLine -like ('*' + $projectRoot + '*')) {
        Stop-Process -Id $savedProcessId -ErrorAction Stop
        Write-Host "$name stopped."
    } elseif ($managed) { throw "Process $savedProcessId is not part of this workspace; it was left running." }
    Remove-Item -LiteralPath $pidFile
}
if ($StopDatabase) {
    & (Join-Path $postgresBin 'pg_ctl.exe') stop -D $postgresData -m fast
    if ($LASTEXITCODE -ne 0) { throw 'The development database could not be stopped.' }
}

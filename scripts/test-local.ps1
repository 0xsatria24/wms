. (Join-Path $PSScriptRoot 'local-environment.ps1')
& (Join-Path $postgresBin 'pg_isready.exe') -h 127.0.0.1 -p 55432 *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start the isolated development database with scripts/start-local.ps1 first.' }
$previousTestAdmin = $env:WMS_TEST_ADMIN
$env:WMS_TEST_ADMIN = $env:WMS_DATABASE
try {
    & $dotnetPath test (Join-Path $projectRoot 'backend\Wms.Tests\Wms.Tests.csproj') --no-restore --logger 'trx;LogFileName=postgres-foundation.trx' --results-directory (Join-Path $projectRoot 'backend\Wms.Tests\TestResults')
    $testExitCode = $LASTEXITCODE
} finally {
    if ($null -eq $previousTestAdmin) { Remove-Item Env:\WMS_TEST_ADMIN -ErrorAction SilentlyContinue }
    else { $env:WMS_TEST_ADMIN = $previousTestAdmin }
}
exit $testExitCode

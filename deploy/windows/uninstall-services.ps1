param([Parameter(Mandatory=$true)][string]$InstallDir)
. (Join-Path $PSScriptRoot 'configuration.ps1')
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
$entries = @(@{Name='InventoryWms.Worker';File='worker\Wms.Worker.exe'}, @{Name='InventoryWms.Api';File='api\Wms.Api.exe'})
foreach ($entry in $entries) { $null = Assert-WmsServicePath $entry.Name (Join-Path $InstallDir $entry.File) }
foreach ($entry in $entries) {
    $service = Get-Service $entry.Name -ErrorAction SilentlyContinue
    if ($service) {
        Stop-Service $entry.Name -ErrorAction Stop
        $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
        Invoke-WmsSc -ScArguments @('delete', $entry.Name)
    }
}
Write-Host 'Application services removed. PostgreSQL and ProgramData were preserved.'

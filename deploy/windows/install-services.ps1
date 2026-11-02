param(
    [Parameter(Mandatory=$true)][string]$InstallDir,
    [Parameter(Mandatory=$true)][string]$ConfigPath,
    [switch]$ValidateOnly
)
. (Join-Path $PSScriptRoot 'configuration.ps1')
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
$dataDir = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'InventoryWms'
Assert-WmsDataPathSafe $dataDir
$programFilesRoot = [IO.Path]::GetFullPath([Environment]::GetFolderPath('ProgramFiles')).TrimEnd('\') + '\'
if (-not $InstallDir.StartsWith($programFilesRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Install application services inside Program Files.' }
$ancestor = $InstallDir
while ($ancestor) {
    if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Reparse points are not allowed in the application path.' }
    $ancestor = Split-Path -Parent $ancestor
}
$config = Read-WmsClientConfiguration $ConfigPath
Test-WmsPrerequisites $config
$services = @(
    @{ Name='InventoryWms.Api'; Relative='api\Wms.Api.exe' },
    @{ Name='InventoryWms.Worker'; Relative='worker\Wms.Worker.exe' }
)
foreach ($entry in $services) {
    $existing = Assert-WmsServicePath $entry.Name (Join-Path $InstallDir $entry.Relative)
    if ($existing -and $existing.State -ne 'Stopped') { throw 'Stop both InventoryWms services before installing/upgrading.' }
}
if ($ValidateOnly) { Write-Host 'Configuration and prerequisites validated.'; exit 0 }
foreach ($entry in $services) {
    if (-not (Test-Path -LiteralPath (Join-Path $InstallDir $entry.Relative))) { throw 'Published Windows executables are missing.' }
}
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run installation as Administrator.' }

$probe = @(& (Join-Path $InstallDir 'api\Wms.Api.exe') --environment Production --contentRoot (Join-Path $InstallDir 'api') --deployment-config $ConfigPath --installation-state)
if ($LASTEXITCODE -ne 0 -or $probe[-1] -notin @('empty', 'initialized')) { throw 'Database state could not be verified. Complete migrations or ask IT to inspect the database.' }
$installationState = $probe[-1]

if (-not (Test-Path -LiteralPath $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
else { Assert-WmsDataPathSafe $dataDir }
Set-WmsPrivateDirectory $dataDir
Initialize-WmsSetup $config $dataDir $installationState
$keys = Join-Path $dataDir 'keys'
$heartbeat = Join-Path $dataDir 'worker-state'
$certDir = Join-Path $dataDir 'certificates'
foreach ($directory in @($keys, $heartbeat, $certDir)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
$certificatePath = Join-Path $certDir 'https.pfx'
if ([IO.Path]::GetFullPath($config.Kestrel.Endpoints.Https.Certificate.Path) -ne $certificatePath) {
    Copy-Item -LiteralPath $config.Kestrel.Endpoints.Https.Certificate.Path -Destination $certificatePath -Force
}
$config.Kestrel.Endpoints.Https.Certificate.Path = $certificatePath
$config.DataProtection.KeyPath = $keys
$config | Add-Member -NotePropertyName Health -NotePropertyValue @{ HeartbeatPath = (Join-Path $heartbeat 'heartbeat.json') } -Force
$targetConfig = Join-Path $dataDir 'appsettings.client.json'
$config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $targetConfig -Encoding UTF8
$workerConfig = Join-Path $dataDir 'appsettings.worker.json'
@{ ConnectionStrings=$config.ConnectionStrings; Erp=$config.Erp; Health=$config.Health; Logging=$config.Logging } |
    ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $workerConfig -Encoding UTF8
foreach ($entry in $services) {
    $exe = Join-Path $InstallDir $entry.Relative
    $root = Split-Path -Parent $exe
    $serviceConfig = if ($entry.Name -eq 'InventoryWms.Api') { $targetConfig } else { $workerConfig }
    $command = '"' + $exe + '" --environment Production --contentRoot "' + $root + '" --deployment-config "' + $serviceConfig + '"'
    $existing = Get-Service -Name $entry.Name -ErrorAction SilentlyContinue
    if ($existing) {
        $managed = Get-CimInstance Win32_Service -Filter "Name='$($entry.Name)'"
        $changed = Invoke-CimMethod -InputObject $managed -MethodName Change -Arguments @{ PathName=$command }
        if ($changed.ReturnValue -ne 0) { throw 'Cannot update the service executable path.' }
    } else {
        New-Service -Name $entry.Name -BinaryPathName $command -StartupType Manual -DependsOn $config.PostgreSqlService | Out-Null
    }
    Invoke-WmsSc -ScArguments @('config', $entry.Name, 'start=', 'delayed-auto', 'obj=', ('NT SERVICE\' + $entry.Name))
    Invoke-WmsSc -ScArguments @('sidtype', $entry.Name, 'unrestricted')
    Invoke-WmsSc -ScArguments @('config', $entry.Name, 'depend=', $config.PostgreSqlService)
    Invoke-WmsSc -ScArguments @('failure', $entry.Name, 'reset=', '86400', 'actions=', 'restart/10000/restart/30000/restart/60000')
    Invoke-WmsSc -ScArguments @('failureflag', $entry.Name, '1')
    & icacls.exe $dataDir /grant ($('NT SERVICE\' + $entry.Name + ':RX')) | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot grant service configuration access.' }
    & icacls.exe $serviceConfig /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' ($('NT SERVICE\' + $entry.Name + ':R')) | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict service configuration access.' }
}
& icacls.exe $certDir /grant 'NT SERVICE\InventoryWms.Api:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot grant API certificate access.' }
& icacls.exe $keys /grant 'NT SERVICE\InventoryWms.Api:(OI)(CI)M' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot grant API key storage access.' }
& icacls.exe $heartbeat /grant 'NT SERVICE\InventoryWms.Worker:(OI)(CI)M' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot grant worker heartbeat access.' }
try {
    Start-Service 'InventoryWms.Api'
    $ready = $false
    $origin = $config.Kestrel.Endpoints.Https.Url.TrimEnd('/')
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try { if ((Invoke-WebRequest "$origin/health/setup-ready" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { $ready = $true; break } } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'API is not ready. Check Windows Application events, database migrations and TLS. Services have been stopped.' }
    Start-Service 'InventoryWms.Worker'
    "[InternetShortcut]`r`nURL=$origin/" | Set-Content -LiteralPath (Join-Path $InstallDir 'Inventory WMS.url') -Encoding ASCII
    Write-Host "Installed. Open $origin. Persistent data: $dataDir"
    if ($installationState -eq 'empty' -and (Test-Path -LiteralPath (Join-Path $dataDir 'secrets\setup-code.txt'))) { Write-Host "Setup code (IT administrators only): $(Join-Path $dataDir 'secrets\setup-code.txt'). No code is written to the installer log." }
} catch {
    foreach ($name in @('InventoryWms.Worker', 'InventoryWms.Api')) { Stop-Service $name -ErrorAction SilentlyContinue }
    throw
}

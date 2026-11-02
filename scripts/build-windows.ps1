param(
    [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = '1.0.0',
    [string]$OutputDirectory = '',
    [string]$InnoCompiler = '',
    [switch]$PackageOnly
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot ('outputs\windows-local\' + $Version + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Choose a new output directory; existing output is never overwritten.' }
$payload = Join-Path $OutputDirectory 'payload'
New-Item -ItemType Directory -Path $payload -Force | Out-Null
$dotnet = Join-Path $repoRoot '.tools\dotnet\dotnet.exe'
if (-not (Test-Path -LiteralPath $dotnet)) { $dotnet = (Get-Command dotnet -ErrorAction Stop).Source }
$env:DOTNET_CLI_HOME = Join-Path $repoRoot '.runtime\dotnet-home'
$env:NUGET_PACKAGES = Join-Path $repoRoot '.tools\nuget'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
& npm.cmd --prefix (Join-Path $repoRoot 'prototype') run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
foreach ($component in @('Api', 'Worker')) {
    $destination = Join-Path $payload $component.ToLowerInvariant()
    & $dotnet publish (Join-Path $repoRoot "backend\Wms.$component\Wms.$component.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -p:IsTransformWebConfigDisabled=true -o $destination
    if ($LASTEXITCODE -ne 0) { throw "Windows $component publish failed." }
}
$webRoot = Join-Path $payload 'api\wwwroot'
New-Item -ItemType Directory -Path $webRoot -Force | Out-Null
Copy-Item -Path (Join-Path $repoRoot 'prototype\dist\client\*') -Destination $webRoot -Recurse
Copy-Item -Path (Join-Path $repoRoot 'deploy\windows') -Destination (Join-Path $payload 'deployment') -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\implementation\windows-local.md') -Destination (Join-Path $payload 'README.md')
@{ version=$Version; runtime='win-x64'; selfContained=$true; builtAt=(Get-Date).ToUniversalTime().ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payload 'build.json') -Encoding UTF8
if ($PackageOnly) { Write-Host "Portable deployment package: $payload (installer compilation skipped explicitly)."; exit 0 }
if (-not $InnoCompiler) {
    foreach ($candidate in @((Join-Path $repoRoot '.tools\inno\ISCC.exe'), "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe")) {
        if (Test-Path -LiteralPath $candidate) { $InnoCompiler = $candidate; break }
    }
}
if (-not $InnoCompiler) { throw "Windows payload built at $payload, but Setup.exe is not compiled. Install Inno Setup 6 or pass -InnoCompiler." }
& $InnoCompiler /Q "/DPayloadDir=$payload" "/DAppVersion=$Version" "/O$OutputDirectory" (Join-Path $repoRoot 'deploy\windows\setup.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }
$installer = Join-Path $OutputDirectory 'InventoryWms-Setup.exe'
if (-not (Test-Path -LiteralPath $installer)) { throw 'Installer compiler did not produce Setup.exe.' }
Write-Host "Installer: $installer"

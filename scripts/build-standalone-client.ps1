param([ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version='1.1.1',[string]$OutputDirectory='', [string]$ApplicationPayload='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(!$OutputDirectory){$OutputDirectory=Join-Path $root ('outputs\windows-local\standalone-'+$Version+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))}
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
if(Test-Path -LiteralPath $OutputDirectory){throw 'Choose a new output directory.'}
if(!$ApplicationPayload){
    $appOutput=Join-Path $root ('outputs\windows-local\app-'+$Version+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
    $shell=Join-Path $PSHOME $(if($PSEdition -eq 'Core'){'pwsh.exe'}else{'powershell.exe'})
    & $shell -NoProfile -File (Join-Path $PSScriptRoot 'build-windows.ps1') -Version $Version -OutputDirectory $appOutput -PackageOnly
    if($LASTEXITCODE -ne 0){throw 'Application publish failed.'}
    $ApplicationPayload=Join-Path $appOutput 'payload'
}
$payload=Join-Path $OutputDirectory 'payload'
New-Item -ItemType Directory -Path $payload -Force|Out-Null
foreach($component in @('api','worker')){Copy-Item -LiteralPath (Join-Path $ApplicationPayload $component) -Destination $payload -Recurse}
$launcher=Join-Path $payload 'launcher'
$dotnet=Join-Path $root '.tools\dotnet\dotnet.exe'
& $dotnet publish (Join-Path $root 'tools\Wms.LocalLauncher\Wms.LocalLauncher.csproj') -c Release -r win-x64 --self-contained true -o $launcher
if($LASTEXITCODE -ne 0){throw 'Windows launcher publish failed.'}
$deployment=Join-Path $payload 'deployment'
New-Item -ItemType Directory -Path $deployment|Out-Null
foreach($file in @('configuration.ps1','standalone-model.ps1','standalone-process.ps1','install-standalone.ps1','uninstall-standalone.ps1','verify-standalone.ps1')){Copy-Item -LiteralPath (Join-Path $root ('deploy\windows\'+$file)) -Destination $deployment}
$dependencies=Join-Path $payload 'dependencies'
New-Item -ItemType Directory -Path $dependencies|Out-Null
$redist=Join-Path $root '.tools\vcredist\vc_redist.x64.exe'
$signature=Get-AuthenticodeSignature -LiteralPath $redist
if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation'){throw 'The Visual C++ package must have a valid Microsoft signature.'}
Copy-Item -LiteralPath $redist -Destination (Join-Path $dependencies 'vc_redist.x64.exe')
$pgSource='C:\Program Files\PostgreSQL\18'
$pg=Join-Path $dependencies 'postgres';New-Item -ItemType Directory -Path $pg|Out-Null
foreach($directory in @('bin','lib','share')){Copy-Item -LiteralPath (Join-Path $pgSource $directory) -Destination $pg -Recurse}
foreach($file in @('server_license.txt','commandlinetools_3rd_party_licenses.txt')){Copy-Item -LiteralPath (Join-Path $pgSource $file) -Destination $pg}
& (Join-Path $pg 'bin\postgres.exe') --version
if($LASTEXITCODE -ne 0){throw 'Bundled PostgreSQL cannot execute.'}
$pgVersion=(& (Join-Path $pg 'bin\postgres.exe') --version)-replace '^.*PostgreSQL\)\s*',''
if($pgVersion -notmatch '^18\.'){throw 'PostgreSQL 18 required'}
$javaSource=Get-ChildItem (Join-Path $root '.tools') -Directory -Filter 'jdk-25*'|Select-Object -First 1
if(!$javaSource){throw 'Portable Java 25 missing'}
Copy-Item -LiteralPath $javaSource.FullName -Destination (Join-Path $dependencies 'java') -Recurse
$kcSource=Join-Path $root '.tools\keycloak-26.8.1'
$kc=Join-Path $dependencies 'keycloak';New-Item -ItemType Directory -Path $kc|Out-Null
foreach($directory in @('bin','lib','providers','themes')){Copy-Item -LiteralPath (Join-Path $kcSource $directory) -Destination $kc -Recurse}
New-Item -ItemType Directory -Path (Join-Path $kc 'conf')|Out-Null
Copy-Item -LiteralPath (Join-Path $kcSource 'conf\cache-ispn.xml') -Destination (Join-Path $kc 'conf')
'# Runtime configuration is generated privately by the Local Test installer.'|Set-Content -LiteralPath (Join-Path $kc 'conf\keycloak.conf') -Encoding ASCII
foreach($file in @('LICENSE.txt','README.md','version.txt')){Copy-Item -LiteralPath (Join-Path $kcSource $file) -Destination $kc}
$env:JAVA_HOME=Join-Path $dependencies 'java'
foreach($name in @(Get-ChildItem Env: | Where-Object Name -like 'KC_*'|Select-Object -ExpandProperty Name)){Remove-Item ('Env:'+$name)}
& (Join-Path $kc 'bin\kc.bat') build --db=postgres --health-enabled=true
if($LASTEXITCODE -ne 0){throw 'Independent Keycloak postgres build failed.'}
if(Test-Path -LiteralPath (Join-Path $kc 'data')){throw 'Keycloak build unexpectedly generated data; inspect before packaging.'}
$wrapper=Join-Path $root '.tools\winsw-2.12.0\WinSW.exe'
if((Get-FileHash -LiteralPath $wrapper -Algorithm SHA256).Hash -ne 'B5066B7BBDFBA1293E5D15CDA3CAAEA88FBEAB35BD5B38C41C913D492AADFC4F'){throw 'Unexpected WinSW binary hash'}
$service=Join-Path $dependencies 'service';New-Item -ItemType Directory -Path $service|Out-Null
Copy-Item -LiteralPath $wrapper -Destination (Join-Path $service 'IdentityService.exe')
Copy-Item -LiteralPath (Join-Path $root '.tools\winsw-2.12.0\LICENSE.txt') -Destination $service
Copy-Item -LiteralPath (Join-Path $root 'docs\implementation\standalone-client-test.md') -Destination (Join-Path $payload 'README.md')
$manifest=@{version=$Version;profile='local-test-only';builtAt=[DateTimeOffset]::UtcNow.ToString('o');runtime='win-x64';postgres=$pgVersion;keycloak='26.8.1';java=$javaSource.Name;serviceWrapper='WinSW 2.12.0';visualCpp=(Get-Item -LiteralPath $redist).VersionInfo.FileVersion;sources=@('https://www.postgresql.org/download/windows/','https://github.com/keycloak/keycloak/releases/tag/26.8.1','https://adoptium.net/temurin/releases/','https://github.com/winsw/winsw/releases/tag/v2.12.0','https://aka.ms/vc14/vc_redist.x64.exe');excluded=@('development data','development secrets','SMTP configuration')}
$manifest|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $payload 'build.json') -Encoding UTF8
$hashes=@(Get-ChildItem -LiteralPath $payload -File -Recurse|ForEach-Object{@{path=$_.FullName.Substring($payload.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}})
$hashes|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $payload 'sha256-manifest.json') -Encoding UTF8
& (Join-Path $PSScriptRoot 'test-standalone-payload.ps1') -PayloadDir $payload
if($LASTEXITCODE -ne 0){throw 'Payload validation failed.'}
& (Join-Path $root '.tools\inno\ISCC.exe') /Q "/DPayloadDir=$payload" "/DAppVersion=$Version" "/O$OutputDirectory" (Join-Path $root 'deploy\windows\standalone.iss')
if($LASTEXITCODE -ne 0){throw 'Full installer compilation failed.'}
Get-FileHash -LiteralPath (Join-Path $OutputDirectory 'InventoryWms-LocalTest-Setup.exe') -Algorithm SHA256|Select-Object Hash
$parts=@(Get-ChildItem -LiteralPath $OutputDirectory -File|Where-Object Extension -in @('.exe','.bin'))
if(@($parts|Where-Object Extension -eq '.bin').Count -eq 0){throw 'External installer data is missing'}
if((Get-Item (Join-Path $OutputDirectory 'InventoryWms-LocalTest-Setup.exe')).Length -gt 5MB){throw 'Installer bootstrap must remain small'}
$readme=Join-Path $OutputDirectory 'START-HERE.txt'
@('Extract this entire ZIP into a local folder. Keep Setup.exe and all .bin files together.','Run InventoryWms-LocalTest-Setup.exe as Administrator.','Choose company, warehouse/location and your administrator email/password. No JSON is required.','First installation includes PostgreSQL and Keycloak and can take several minutes; the installer shows each stage.','Open the Inventory WMS Local Test shortcut. It launches a Windows GUI and then your browser.','Local-test package only. SMTP, clean-client UAT and a real OS reboot remain separate checks.')|Set-Content -LiteralPath $readme -Encoding UTF8
$zip=Join-Path $OutputDirectory ('InventoryWms-LocalTest-'+$Version+'.zip')
Compress-Archive -LiteralPath (@($parts.FullName)+@($readme)) -DestinationPath $zip -CompressionLevel NoCompression
Write-Host ('Full Local Test package: '+$zip)

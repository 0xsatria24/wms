param([Parameter(Mandatory=$true)][string]$PayloadDir)
$ErrorActionPreference='Stop'
$build=Get-Content -LiteralPath (Join-Path $PayloadDir 'build.json') -Raw|ConvertFrom-Json
if([version]$build.version -ge [version]'1.1.1'){
    $launcher=Join-Path $PayloadDir 'launcher\InventoryWms.exe'
    $pe=[IO.File]::ReadAllBytes($launcher)
    $header=[BitConverter]::ToInt32($pe,0x3c)
    if([BitConverter]::ToUInt16($pe,$header+24+68) -ne 2){throw 'Launcher must use the Windows GUI subsystem, not a console.'}
    if(!(Test-Path -LiteralPath (Join-Path $PayloadDir 'deployment\standalone-process.ps1'))){throw 'Native process helper is missing'}
}
if(!(Test-Path -LiteralPath (Join-Path $PayloadDir 'dependencies\vc_redist.x64.exe'))){throw 'Microsoft Visual C++ redistributable missing'}
foreach($file in @('api\Wms.Api.exe','api\wwwroot\index.html','worker\Wms.Worker.exe','dependencies\postgres\bin\postgres.exe','dependencies\postgres\bin\initdb.exe','dependencies\postgres\lib\plpgsql.dll','dependencies\postgres\share\postgres.bki','dependencies\java\bin\java.exe','dependencies\java\legal\java.base\LICENSE','dependencies\keycloak\lib\quarkus-run.jar','dependencies\keycloak\LICENSE.txt','dependencies\service\IdentityService.exe','dependencies\service\LICENSE.txt','deployment\install-standalone.ps1','build.json','sha256-manifest.json')){if(!(Test-Path -LiteralPath (Join-Path $PayloadDir $file))){throw ('Payload missing: '+$file)}}
foreach($path in @('.runtime','.git','dependencies\keycloak\data','dependencies\postgres\data','initial-realm.json','appsettings.client.json','installation.json')){if(Test-Path -LiteralPath (Join-Path $PayloadDir $path)){throw ('Private state in payload: '+$path)}}
foreach($file in Get-ChildItem -LiteralPath $PayloadDir -File -Recurse){if($file.Extension -in @('.pfx','.p12','.mv.db') -or $file.Name -eq 'PG_VERSION'){throw ('Private credential or database found: '+$file.Name)}}
$config=Get-Content -LiteralPath (Join-Path $PayloadDir 'dependencies\keycloak\conf\keycloak.conf') -Raw
if($config -match 'password|secret|OneDrive|Projects'){throw 'Bundled identity config includes runtime configuration.'}
foreach($entry in (Get-Content -LiteralPath (Join-Path $PayloadDir 'sha256-manifest.json') -Raw|ConvertFrom-Json)){
    $path=[IO.Path]::GetFullPath((Join-Path $PayloadDir $entry.path))
    if(!$path.StartsWith([IO.Path]::GetFullPath($PayloadDir).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Manifest path escapes payload'}
    if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $entry.sha256){throw ('Payload hash mismatch: '+$entry.path)}
}
'PASS: full dependency payload, license notices, no bundled runtime state and SHA-256 manifest.'

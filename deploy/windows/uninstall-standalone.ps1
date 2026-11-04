param([Parameter(Mandatory=$true)][string]$InstallDir)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'standalone-model.ps1')
$expected=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Inventory WMS Local Test'
if([IO.Path]::GetFullPath($InstallDir).TrimEnd('\') -ne $expected){throw 'Unexpected installation directory.'}
foreach($name in @('Worker','Api','Identity','Database')) {
    $service=Get-CimInstance Win32_Service -Filter "Name='InventoryWmsTest.$name'"
    if(!$service){continue}
    if($service.PathName.IndexOf($InstallDir,[StringComparison]::OrdinalIgnoreCase) -lt 0){throw 'Service belongs to another installation.'}
    Stop-Service $service.Name -ErrorAction Stop
    & "$env:SystemRoot\System32\sc.exe" delete $service.Name|Out-Null
    if($LASTEXITCODE -ne 0){throw 'Cannot remove owned test service.'}
}
$link=Join-Path $InstallDir 'dependencies\keycloak\data'
if(Test-Path -LiteralPath $link){
    $item=Get-Item -LiteralPath $link -Force
    $expectedData=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'InventoryWmsLocalTest\identity-data'
    if(!($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or [IO.Path]::GetFullPath([string]$item.Target) -ne $expectedData){throw 'Unexpected identity data link; no data was removed.'}
    [IO.Directory]::Delete($link)
}
'Owned test services removed. Databases, accounts, private configuration and local-test certificate were retained for reinstall.'

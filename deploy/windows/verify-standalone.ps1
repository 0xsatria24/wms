$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'standalone-model.ps1')
$profile=Get-WmsTestProfile
foreach($name in @('Database','Identity','Api','Worker')){if((Get-Service "InventoryWmsTest.$name").Status -ne 'Running'){throw ('Local Test service unavailable: '+$name)}}
$ready=$false
$deadline=[Diagnostics.Stopwatch]::StartNew()
while($deadline.Elapsed.TotalSeconds -lt 120){
    try {
        $state=(Get-WmsTestHttp ($profile.Origin+'/api/setup/status')).Body|ConvertFrom-Json
        $health=Get-WmsTestHttp ($profile.Origin+'/health/ready')
        $discovery=(Get-WmsTestHttp ($profile.IdentityOrigin+'/realms/wms-test/.well-known/openid-configuration')).Body|ConvertFrom-Json
        if($state.state -eq 'completed' -and $health.Status -eq 200 -and $discovery.issuer -eq ($profile.IdentityOrigin+'/realms/wms-test')){$ready=$true;break}
    }catch{}
    Start-Sleep -Seconds 2
}
if(!$ready){throw 'Local Test health or identity discovery failed.'}
 $response=Get-WmsTestHttp ($profile.Origin+'/auth/login?rememberMe=false')
$status=$response.Status
$location=$response.Location
if($status -ne 302 -or !$location.StartsWith($profile.IdentityOrigin+'/realms/wms-test/')){throw 'Login did not redirect to the local identity provider.'}
foreach($service in Get-CimInstance Win32_Service -Filter "Name LIKE 'InventoryWmsTest.%'"){
    if($service.PathName -match 'OneDrive|D:\\Projects|\.runtime'){throw 'An installed service still depends on source paths.'}
    if($service.StartMode -ne 'Auto'){throw 'A Local Test service is not configured to start automatically.'}
}
'PASS: four automatic services, database-backed readiness, completed setup, identity discovery, login redirect and installed paths.'

$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'standalone-model.ps1')
$profile=Get-WmsTestProfile
for($attempt=0;$attempt -lt 60;$attempt++) {
    try {
        $health=Get-WmsTestHttp ($profile.Origin+'/health/ready')
        $identity=Get-WmsTestHttp ($profile.IdentityOrigin+'/realms/wms-test/.well-known/openid-configuration')
        if($health.Status -eq 200 -and $identity.Status -eq 200){Start-Process ($profile.Origin+'/');exit 0}
    }catch{}
    Start-Sleep -Seconds 2
}
Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.MessageBox]::Show('Inventory WMS Local Test is not ready. Ask IT to check the InventoryWmsTest.Database, Identity, Api and Worker services. Do not reinstall or reset your account.','Inventory WMS Local Test',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Warning)|Out-Null
exit 1

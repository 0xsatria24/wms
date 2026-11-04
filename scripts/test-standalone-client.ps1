$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../deploy/windows/standalone-model.ps1')
$profile=Get-WmsTestProfile
$failed=[pscustomobject]@{Profile='InventoryWmsLocalTest';Stage='preparing'}
if(!(Test-WmsEmptyFailedInstall $failed $false $false $false)){throw 'An empty failed install should be recoverable without deleting data'}
foreach($flags in @(@($true,$false,$false),@($false,$true,$false),@($false,$false,$true))){if(Test-WmsEmptyFailedInstall $failed $flags[0] $flags[1] $flags[2]){throw 'A database, data files or existing service must prevent automatic recovery'}}
if($profile.Origin -ne 'https://127.0.0.1:5444' -or $profile.DatabasePort -ne 5544 -or $profile.IdentityOrigin -ne 'https://127.0.0.1:8444'){throw 'Test installation is not isolated'}
$inputData=[pscustomobject]@{Company='Client fixture';Warehouse='Warehouse A';Location='A-01';Name='Test Admin';Email='admin@example.test';Password='Fixture-password-42!'}
Test-WmsTestInput $inputData
foreach($change in @(@{Email='bad email'},@{Password='short'},@{Location='Receiving'},@{Location=' Receiving '},@{Location='QC '},@{Location='A|B'},@{Company=''},@{Name=''},@{Warehouse=''},@{Email="admin@example.test`nextra"})) {
  $copy=$inputData|ConvertTo-Json|ConvertFrom-Json
  foreach($key in $change.Keys){$copy.$key=$change[$key]}
  $rejected=$false;try{Test-WmsTestInput $copy}catch{$rejected=$true}
  if(!$rejected){throw ('Invalid input accepted: '+($change.Keys -join ','))}
}
$secrets=New-WmsTestSecrets
if($secrets.Database -eq $secrets.IdentityDatabase -or $secrets.Oidc -eq $secrets.Provisioning -or $secrets.Database.Length -lt 40){throw 'Secrets are not independent'}
$realm=New-WmsTestRealm $inputData $secrets
if($realm.realm -ne 'wms-test' -or $realm.users[0].id -ne $secrets.Subject -or !$realm.users[0].emailVerified){throw 'Initial account identity is inconsistent'}
$app=@($realm.clients|Where-Object clientId -eq 'inventory-wms-test')[0]
if($app.publicClient -or $app.directAccessGrantsEnabled -or $app.redirectUris[0] -ne ($profile.Origin+'/signin-oidc')){throw 'OIDC flow is not restricted'}
if(@($realm.users|Where-Object username -eq 'service-account-wms-provisioning').Count -ne 1){throw 'Provisioning service account missing'}
if(($realm|ConvertTo-Json -Depth 30) -match 'wms-admin@localhost|wms-local|OneDrive|D:\\Projects'){throw 'Development identity leaked into realm'}
$config=New-WmsTestConfiguration $inputData $secrets 'C:\Program Files\Inventory WMS Local Test' 'C:\ProgramData\InventoryWmsLocalTest'
if($config.AllowedHosts -ne '127.0.0.1' -or $config.Development.EnableDemoAuth -or $config.Database.MigrateOnStartup){throw 'Unexpected demo or network configuration'}
if($config.WindowsService.Name -ne 'InventoryWmsTest.Api' -or $config.IdentityProvisioning.ReturnUrl -ne $profile.Origin+'/'){throw 'Service/provisioning configuration mismatch'}
$json=$config|ConvertTo-Json -Depth 20
if($json.Contains($inputData.Password)){throw 'User password persisted in application config'}
foreach($file in @('standalone-model.ps1','install-standalone.ps1','uninstall-standalone.ps1','verify-standalone.ps1','open-standalone.ps1')) {
  $path=Join-Path $PSScriptRoot ('../deploy/windows/'+$file)
  if(!(Test-Path $path)){throw ('Missing deployment script: '+$file)}
  $parseErrors=$null;[System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$null,[ref]$parseErrors)|Out-Null
  if($parseErrors){throw ('Invalid syntax: '+$file+': '+($parseErrors.Message -join '; '))}
}
'PASS: isolated profile, invalid input rejection, independent secrets, realm identity, OIDC restrictions, service account and private configuration.'

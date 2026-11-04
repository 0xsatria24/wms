param([Parameter(Mandatory=$true)][string]$InstallDir,[string]$InputPath='', [switch]$ValidateOnly,[switch]$PrepareInput)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'standalone-model.ps1')
. (Join-Path $PSScriptRoot 'configuration.ps1')
. (Join-Path $PSScriptRoot 'standalone-process.ps1')
$profile=Get-WmsTestProfile
$data=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) $profile.DataFolder
$expected=Join-Path ([Environment]::GetFolderPath('ProgramFiles')) $profile.Folder
if([IO.Path]::GetFullPath($InstallDir).TrimEnd('\') -ne $expected){throw 'Use the fixed Program Files Local Test installation directory.'}
foreach($path in @($InstallDir,$data)) {
    $ancestor=$path
    while($ancestor){if((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Installation/data ancestors cannot be links.'};$ancestor=Split-Path -Parent $ancestor}
}
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run the installer as Administrator.'}
$statePath=Join-Path $data 'installation.json'
$state=$null
$recoverEmpty=$false
$services=@(Get-CimInstance Win32_Service -Filter "Name LIKE 'InventoryWmsTest.%'")
if(Test-Path -LiteralPath $data){
    $acl=Get-Acl -LiteralPath $data
    if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18','S-1-5-32-544')){throw 'Local Test data directory must be owned by Administrators or SYSTEM.'}
    foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @('S-1-5-18','S-1-5-32-544')) {
            $allowed=$false
            foreach($name in @('Database','Identity','Api','Worker')){try{if($rule.IdentityReference.Value -eq (New-Object Security.Principal.NTAccount("NT SERVICE\InventoryWmsTest.$name")).Translate([Security.Principal.SecurityIdentifier]).Value){$allowed=$true}}catch{}}
            if(!$allowed){throw 'Untrusted permissions on Local Test data directory.'}
        }
    }
    if(Test-Path -LiteralPath $statePath){
        $state=Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json
        $recoverEmpty=Test-WmsEmptyFailedInstall $state (Test-Path -LiteralPath (Join-Path $data 'pgdata\PG_VERSION')) (@(Get-ChildItem -LiteralPath (Join-Path $data 'pgdata') -Force -ErrorAction SilentlyContinue).Count -gt 0) ($services.Count -gt 0)
        if($state.Profile -ne 'InventoryWmsLocalTest' -or $state.Stage -notin @('preparing','complete') -or !$state.Secrets){throw 'Unrecognized installation data; preserve it for administrator review.'}
    }
}
foreach($name in @('Database','Identity','Api','Worker')){
    $service=$services|Where-Object Name -eq "InventoryWmsTest.$name"
    if($service -and (!$state -or $service.PathName.IndexOf($InstallDir,[StringComparison]::OrdinalIgnoreCase) -lt 0)){throw 'Service name belongs to another installation.'}
    if($service -and $service.State -ne 'Stopped'){throw 'Stop the four InventoryWmsTest services before reinstalling. Data is preserved.'}
}
foreach($port in @(5544,5444,8444,9004)) {if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){throw "Port $port is already occupied. No existing service will be stopped."}}
if($ValidateOnly){'Local Test preflight passed';return}
if($recoverEmpty){
    $archive=$data+'-failed-'+(Get-Date -Format 'yyyyMMdd-HHmmss')
    if([IO.Path]::GetDirectoryName($archive) -ne [IO.Path]::GetDirectoryName($data) -or (Test-Path -LiteralPath $archive)){throw 'Cannot safely archive the empty failed installation.'}
    Move-Item -LiteralPath $data -Destination $archive
    $state=$null
}
if(!(Test-Path -LiteralPath $data)){New-Item -ItemType Directory -Path $data|Out-Null;Set-WmsPrivateDirectory $data}
if($PrepareInput){return}
$log=Join-Path $data 'installation.log'
function Write-Stage([string]$Stage){('['+(Get-Date).ToString('o')+'] '+$Stage)|Add-Content -LiteralPath $log -Encoding UTF8;Write-Output ('WMS_STAGE:'+ $Stage)}
function Invoke-Checked([string]$Exe,[string[]]$Arguments,[string]$Stage){
    Write-Stage $Stage
    $result=Invoke-WmsNative $Exe $Arguments
    foreach($text in @($result.StandardOutput,$result.StandardError)){if($text){Add-Content -LiteralPath $log -Value $text -Encoding UTF8}}
    if($result.TimedOut -or $result.ExitCode -ne 0){throw ($Stage+' failed. Inspect protected installation.log.')}
}
function Grant-Service([string]$Path,[string]$Name,[string]$Rights='RX'){
    & icacls.exe $Path /grant ('NT SERVICE\InventoryWmsTest.'+$Name+':'+$Rights)|Out-Null
    if($LASTEXITCODE -ne 0){throw 'Cannot grant service directory access.'}
}
function Configure-Service([string]$Name,[string]$DependsOn){
    Invoke-WmsSc @('config',$Name,'obj=',('NT SERVICE\'+$Name),'start=','delayed-auto','depend=',$DependsOn)
    Invoke-WmsSc @('sidtype',$Name,'unrestricted')
    Invoke-WmsSc @('failure',$Name,'reset=','86400','actions=','restart/10000/restart/30000/restart/60000')
}
$pg=Join-Path $InstallDir 'dependencies\postgres\bin'
$kc=Join-Path $InstallDir 'dependencies\keycloak'
$java=Join-Path $InstallDir 'dependencies\java'
$env:JAVA_HOME=$java
foreach($name in @(Get-ChildItem Env:|Where-Object Name -like 'KC_*'|Select-Object -ExpandProperty Name)){Remove-Item ('Env:'+$name)}
$env:KC_DB='postgres'
foreach($name in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','KC_DB_URL','KC_DB_USERNAME','KC_DB_PASSWORD','KC_BOOTSTRAP_ADMIN_USERNAME','KC_BOOTSTRAP_ADMIN_PASSWORD','KC_HTTPS_KEY_STORE_FILE','KC_HTTPS_KEY_STORE_PASSWORD')){Remove-Item ('Env:'+$name) -ErrorAction SilentlyContinue}
$fresh=$null -eq $state
$pending=$fresh -or $state.Stage -ne 'complete'
$realmPath=Join-Path $data 'initial-realm.json'
$temporary=@()
try {
    if($pending){
        $value=Get-Content -LiteralPath $InputPath -Raw|ConvertFrom-Json
        if(!$fresh){$value.Name=$state.Administrator.Name;$value.Email=$state.Administrator.Email;$value.Company=$state.Company;$value.Warehouse=$state.Warehouse;$value.Location=$state.Location}
        Test-WmsTestInput $value
    }
    $redist=Join-Path $InstallDir 'dependencies\vc_redist.x64.exe'
    $signature=Get-AuthenticodeSignature -LiteralPath $redist
    if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation'){throw 'Visual C++ runtime package signature is not trusted.'}
    $installedRuntime=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64' -ErrorAction SilentlyContinue
    $requiredVersion=[version](Get-Item -LiteralPath $redist).VersionInfo.FileVersion
    if(!$installedRuntime -or !$installedRuntime.Installed -or [version]$installedRuntime.Version.TrimStart('v') -lt $requiredVersion){
        Write-Stage 'Install Microsoft Visual C++ runtime'
        $runtime=Start-Process -FilePath $redist -ArgumentList @('/install','/quiet','/norestart','/log',('"'+(Join-Path $data 'visual-cpp-install.log')+'"')) -Wait -PassThru -WindowStyle Hidden
        if($runtime.ExitCode -notin @(0,3010,1638)){throw 'Visual C++ runtime installation failed.'}
        if($runtime.ExitCode -eq 3010){Write-Stage 'Visual C++ runtime requested a Windows restart'}
    }
    if($fresh){
        $secrets=New-WmsTestSecrets
        $realm=New-WmsTestRealm $value $secrets
        $realm|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $realmPath -Encoding UTF8
        $state=@{Profile='InventoryWmsLocalTest';Stage='preparing';Version=(Get-Content -LiteralPath (Join-Path $InstallDir 'build.json') -Raw|ConvertFrom-Json).version;Secrets=$secrets;Administrator=@{Name=$value.Name;Email=$value.Email};Company=$value.Company;Warehouse=$value.Warehouse;Location=$value.Location}
        $state|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $statePath -Encoding UTF8
        foreach($dir in @('pgdata','identity-data','keys','certificates','worker-state','logs')){New-Item -ItemType Directory -Path (Join-Path $data $dir) -Force|Out-Null}
        $cert=New-SelfSignedCertificate -Subject 'CN=Inventory WMS Local Test' -FriendlyName 'Inventory WMS Local Test only' -Type Custom -KeyUsage DigitalSignature,KeyEncipherment -KeyLength 3072 -KeyExportPolicy Exportable -TextExtension @('2.5.29.17={text}IPAddress=127.0.0.1','2.5.29.37={text}1.3.6.1.5.5.7.3.1') -CertStoreLocation 'Cert:\LocalMachine\My' -NotAfter (Get-Date).AddYears(1)
        $state.CertificateThumbprint=$cert.Thumbprint
        Export-PfxCertificate -Cert $cert -FilePath (Join-Path $data 'certificates\localhost.pfx') -Password (ConvertTo-SecureString $secrets.Certificate -AsPlainText -Force)|Out-Null
        Export-Certificate -Cert $cert -FilePath (Join-Path $data 'certificates\localhost.cer')|Out-Null
        Import-Certificate -FilePath (Join-Path $data 'certificates\localhost.cer') -CertStoreLocation 'Cert:\LocalMachine\Root'|Out-Null
        $state|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $statePath -Encoding UTF8
        $config=New-WmsTestConfiguration $value $secrets $InstallDir $data
        $config|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $data 'appsettings.client.json') -Encoding UTF8
        @{WindowsService=@{Name='InventoryWmsTest.Worker'};ConnectionStrings=$config.ConnectionStrings;Erp=$config.Erp;Health=$config.Health;Logging=$config.Logging}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $data 'appsettings.worker.json') -Encoding UTF8
        $pwFile=Join-Path $data 'cluster-password.tmp';$temporary+=$pwFile
        $secrets.Cluster|Set-Content -LiteralPath $pwFile -Encoding ASCII
        Write-Stage 'Initialize independent PostgreSQL cluster'
        $initialized=Initialize-WmsPostgres (Join-Path $pg 'initdb.exe') $data $pwFile
        @($initialized.StandardOutput,$initialized.StandardError)|Add-Content -LiteralPath $log -Encoding UTF8
        if($initialized.ExitCode -ne 0 -or $initialized.TimedOut){throw 'PostgreSQL initialization failed; see private log.'}
        @('listen_addresses = ''127.0.0.1''','port = 5544','password_encryption = ''scram-sha-256''')|Add-Content -LiteralPath (Join-Path $data 'pgdata\postgresql.conf')
        'host all all 127.0.0.1/32 scram-sha-256'|Set-Content -LiteralPath (Join-Path $data 'pgdata\pg_hba.conf') -Encoding ASCII
    }else{
        $secrets=$state.Secrets
        $config=Get-Content -LiteralPath (Join-Path $data 'appsettings.client.json') -Raw|ConvertFrom-Json
        Import-Certificate -FilePath (Join-Path $data 'certificates\localhost.cer') -CertStoreLocation 'Cert:\LocalMachine\Root'|Out-Null
    }
    if(!(Get-Service InventoryWmsTest.Database -ErrorAction SilentlyContinue)){Invoke-Checked (Join-Path $pg 'pg_ctl.exe') @('register','-N','InventoryWmsTest.Database','-D',(Join-Path $data 'pgdata'),'-S','demand','-l',(Join-Path $data 'pgdata\server.log')) 'Register database service'}
    Configure-Service 'InventoryWmsTest.Database' 'Tcpip'
    Grant-Service $data 'Database';Grant-Service (Join-Path $data 'pgdata') 'Database' '(OI)(CI)M'
    Start-Service InventoryWmsTest.Database
    $env:PGHOST='127.0.0.1';$env:PGPORT='5544';$env:PGUSER='wms_cluster';$env:PGPASSWORD=$secrets.Cluster;$env:PGDATABASE='postgres';$env:PGCONNECT_TIMEOUT='5'
    $ready=$false
    for($i=0;$i -lt 40;$i++){& (Join-Path $pg 'pg_isready.exe') -h 127.0.0.1 -p 5544 *> $null;if($LASTEXITCODE -eq 0){$ready=$true;break};Start-Sleep -Seconds 2}
    if(!$ready){throw 'Independent database did not become ready.'}
    if($pending){
        $sql=Join-Path $data 'initial-databases.sql';$temporary+=$sql
        $statements=@()
        foreach($role in @(@('wms_app',$secrets.Database),@('wms_migrate',$secrets.Migration),@('wms_identity',$secrets.IdentityDatabase))){
            if($role[1] -notmatch '^[a-f0-9]{64}$'){throw 'Invalid stored infrastructure credential'}
            $statements+=('DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='''+$role[0]+''') THEN CREATE ROLE '+$role[0]+' LOGIN PASSWORD '''+$role[1]+''' NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF; END $$;')
        }
        $statements+=@("SELECT 'CREATE DATABASE wms_test OWNER wms_migrate' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='wms_test')",'\gexec',"SELECT 'CREATE DATABASE wms_identity OWNER wms_identity' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='wms_identity')",'\gexec')
        $statements|Set-Content -LiteralPath $sql -Encoding ASCII
        Invoke-Checked (Join-Path $pg 'psql.exe') @('-X','-w','-v','ON_ERROR_STOP=1','-f',$sql) 'Create isolated application and identity databases'
    }
    $migrate=Join-Path $data 'migration-config.tmp.json';$temporary+=$migrate
    $migration=$config|ConvertTo-Json -Depth 20|ConvertFrom-Json
    $migration.ConnectionStrings.Wms='Host=127.0.0.1;Port=5544;Database=wms_test;Username=wms_migrate;Password='+$secrets.Migration
    $migration|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $migrate -Encoding UTF8
    Invoke-Checked (Join-Path $InstallDir 'api\Wms.Api.exe') @('--environment','Production','--contentRoot',(Join-Path $InstallDir 'api'),'--deployment-config',$migrate,'--migrate-only') 'Migrate local test schema'
    $env:PGDATABASE='wms_test'
    Invoke-Checked (Join-Path $pg 'psql.exe') @('-X','-w','-v','ON_ERROR_STOP=1','-c','GRANT CONNECT ON DATABASE wms_test TO wms_app; GRANT USAGE ON SCHEMA public TO wms_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO wms_app; GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO wms_app; ALTER DEFAULT PRIVILEGES FOR ROLE wms_migrate IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO wms_app;') 'Apply application runtime database privileges'
    if($pending){
        $probe=Invoke-WmsNative (Join-Path $InstallDir 'api\Wms.Api.exe') @('--environment','Production','--contentRoot',(Join-Path $InstallDir 'api'),'--deployment-config',$migrate,'--installation-state')
        if($probe.ExitCode -ne 0 -or $probe.TimedOut){throw 'Cannot verify existing administrator state; no account was overwritten.'}
        $bootstrap=Join-Path $data 'bootstrap.tmp.json';$temporary+=$bootstrap
        @{Issuer=$config.Oidc.Authority;Subject=$secrets.Subject;Email=$value.Email;Name=$value.Name;Warehouses=@(@{Id='main';Name=$value.Warehouse;StorageLocations=@($value.Location)})}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $bootstrap -Encoding UTF8
        if($probe.StandardOutput -match '(?m)^empty\r?$'){
            Invoke-Checked (Join-Path $InstallDir 'api\Wms.Api.exe') @('--environment','Production','--contentRoot',(Join-Path $InstallDir 'api'),'--deployment-config',$migrate,'--bootstrap',$bootstrap) 'Create first test administrator'
        }elseif($probe.StandardOutput -notmatch '(?m)^initialized\r?$'){throw 'Unexpected administrator state; no account was overwritten.'}
        if(!(Test-Path -LiteralPath $realmPath)){New-WmsTestRealm $value $secrets|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $realmPath -Encoding UTF8}
    }
    $identityConf=Join-Path $data 'identity.conf'
    @('db=postgres','db-url=jdbc:postgresql://127.0.0.1:5544/wms_identity','db-username=wms_identity',('db-password='+$secrets.IdentityDatabase),'hostname=https://127.0.0.1:8444','http-host=127.0.0.1','http-enabled=false','https-port=8444',('https-key-store-file='+(Join-Path $data 'certificates\localhost.pfx').Replace('\','/')),('https-key-store-password='+$secrets.Certificate),'https-key-store-type=PKCS12','http-management-host=127.0.0.1','http-management-port=9004','http-management-scheme=http','cache=local','bootstrap-admin-username=wms-test-recovery',('bootstrap-admin-password='+$secrets.Recovery),'log=console')|Set-Content -LiteralPath $identityConf -Encoding ASCII
    $link=Join-Path $kc 'data'
    if(Test-Path -LiteralPath $link){$item=Get-Item -LiteralPath $link -Force;if(!($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or [IO.Path]::GetFullPath([string]$item.Target) -ne (Join-Path $data 'identity-data')){throw 'Unexpected Keycloak data path; refusing overwrite.'}}
    else{New-Item -ItemType Junction -Path $link -Target (Join-Path $data 'identity-data')|Out-Null}
    if($pending){Invoke-Checked (Join-Path $kc 'bin\kc.bat') @('--config-file',$identityConf,'import','--file',$realmPath,'--override','false') 'Import new test identity realm'}
    function Xml([string]$Text){[Security.SecurityElement]::Escape($Text)}
    $arguments='-Xms128m -Xmx512m --add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.base/java.util=ALL-UNNAMED --add-opens=java.base/java.util.concurrent=ALL-UNNAMED --add-opens=java.base/java.security=ALL-UNNAMED --enable-native-access=ALL-UNNAMED -Djava.util.concurrent.ForkJoinPool.common.threadFactory=io.quarkus.bootstrap.forkjoin.QuarkusForkJoinWorkerThreadFactory -Dkc.home.dir="'+$kc+'" -Djboss.server.config.dir="'+$data+'" -Dkeycloak.theme.dir="'+(Join-Path $kc 'themes')+'" -cp "'+(Join-Path $kc 'lib\quarkus-run.jar')+'" io.quarkus.bootstrap.runner.QuarkusEntryPoint --config-file="'+$identityConf+'" start --optimized'
    $wrapper=Join-Path $InstallDir 'dependencies\service\IdentityService.exe'
    $xml='<service><id>InventoryWmsTest.Identity</id><name>Inventory WMS Local Test Identity</name><description>Local-test identity service; independent of source checkout.</description><executable>'+ (Xml (Join-Path $java 'bin\java.exe'))+'</executable><arguments>'+(Xml $arguments)+'</arguments><workingdirectory>'+(Xml $kc)+'</workingdirectory><logpath>'+(Xml (Join-Path $data 'logs'))+'</logpath><log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>3</keepFiles></log><startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart><depend>InventoryWmsTest.Database</depend><stoptimeout>60 sec</stoptimeout><onfailure action="restart" delay="10 sec"/></service>'
    $xml|Set-Content -LiteralPath ([IO.Path]::ChangeExtension($wrapper,'.xml')) -Encoding UTF8
    if(!(Get-Service InventoryWmsTest.Identity -ErrorAction SilentlyContinue)){Invoke-Checked $wrapper @('install') 'Register identity service'}
    Configure-Service 'InventoryWmsTest.Identity' 'InventoryWmsTest.Database'
    Grant-Service $data 'Identity';Grant-Service $identityConf 'Identity';Grant-Service (Join-Path $data 'certificates') 'Identity' '(OI)(CI)RX';Grant-Service (Join-Path $data 'identity-data') 'Identity' '(OI)(CI)M';Grant-Service (Join-Path $data 'logs') 'Identity' '(OI)(CI)M'
    Write-Stage 'Starting sign-in service; first startup can take a few minutes'
    Start-Service InventoryWmsTest.Identity
    $identityReady=$false
    $identityWait=[Diagnostics.Stopwatch]::StartNew()
    while($identityWait.Elapsed.TotalSeconds -lt 180){try{$r=Get-WmsTestHttp ($profile.IdentityOrigin+'/realms/wms-test/.well-known/openid-configuration');if($r.Status -eq 200){$identityReady=$true;break}}catch{};Start-Sleep -Seconds 2}
    if(!$identityReady){throw 'Identity service is not ready. Inspect private identity logs.'}
    foreach($component in @('Api','Worker')){
        $root=Join-Path $InstallDir $component.ToLowerInvariant()
        $cfg=Join-Path $data $(if($component -eq 'Api'){'appsettings.client.json'}else{'appsettings.worker.json'})
        $command='"'+(Join-Path $root ('Wms.'+$component+'.exe'))+'" --environment Production --contentRoot "'+$root+'" --deployment-config "'+$cfg+'"'
        if(!(Get-Service "InventoryWmsTest.$component" -ErrorAction SilentlyContinue)){New-Service -Name "InventoryWmsTest.$component" -BinaryPathName $command -StartupType Manual|Out-Null}
        Configure-Service "InventoryWmsTest.$component" $(if($component -eq 'Api'){'InventoryWmsTest.Database/InventoryWmsTest.Identity'}else{'InventoryWmsTest.Database'})
        Grant-Service $data $component;Grant-Service $cfg $component
    }
    Grant-Service (Join-Path $data 'certificates') 'Api' '(OI)(CI)RX';Grant-Service (Join-Path $data 'keys') 'Api' '(OI)(CI)M';Grant-Service (Join-Path $data 'worker-state') 'Worker' '(OI)(CI)M'
    Write-Stage 'Starting WMS services and checking readiness'
    Start-Service InventoryWmsTest.Api;Start-Service InventoryWmsTest.Worker
    & (Join-Path $PSScriptRoot 'verify-standalone.ps1')
    "[InternetShortcut]`r`nURL=$($profile.Origin)/"|Set-Content -LiteralPath (Join-Path $InstallDir 'Inventory WMS Local Test.url') -Encoding ASCII
    $state.Stage='complete';$state.Version=(Get-Content -LiteralPath (Join-Path $InstallDir 'build.json') -Raw|ConvertFrom-Json).version;$state|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $statePath -Encoding UTF8
    if(Test-Path -LiteralPath $realmPath){Remove-Item -LiteralPath $realmPath -Force}
    Write-Stage 'Installation verified complete'
    'Local Test installation complete. Open https://127.0.0.1:5444. SMTP email is not configured.'
}catch{
    Write-Stage ('Installation failed: '+$_.Exception.GetType().Name)
    ($_|Out-String)|Add-Content -LiteralPath $log -Encoding UTF8
    foreach($name in @('Worker','Api','Identity','Database')){Stop-Service "InventoryWmsTest.$name" -ErrorAction SilentlyContinue}
    throw 'Local Test installation stopped. Existing non-test installation was not changed. Inspect ProgramData\InventoryWmsLocalTest\installation.log.'
}finally{
    foreach($file in @($temporary)+@($InputPath)){if($file -and (Test-Path -LiteralPath $file) -and [IO.Path]::GetFullPath($file).StartsWith($data+'\',[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $file -Force}}
    foreach($name in @('PGPASSWORD','KC_DB_PASSWORD','KC_BOOTSTRAP_ADMIN_PASSWORD')){Remove-Item ('Env:'+$name) -ErrorAction SilentlyContinue}
}

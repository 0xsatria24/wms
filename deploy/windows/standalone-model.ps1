$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -eq 'Desktop'){
    $env:PSModulePath=$PSHOME+'\Modules;'+[Environment]::GetFolderPath('ProgramFiles')+'\WindowsPowerShell\Modules'
}
function Test-WmsEmptyFailedInstall($State,[bool]$HasVersion,[bool]$HasData,[bool]$HasService) {
    $State.Profile -eq 'InventoryWmsLocalTest' -and $State.Stage -eq 'preparing' -and !$HasVersion -and !$HasData -and !$HasService
}
function Get-WmsTestProfile {
    [pscustomobject]@{Origin='https://127.0.0.1:5444';IdentityOrigin='https://127.0.0.1:8444';DatabasePort=5544;Realm='wms-test';Prefix='InventoryWmsTest';Folder='Inventory WMS Local Test';DataFolder='InventoryWmsLocalTest'}
}
function Get-WmsTestHttp([string]$Url) {
    $uri=[Uri]$Url
    if($uri.Scheme -ne 'https' -or $uri.Host -ne '127.0.0.1' -or $uri.Port -notin @(5444,8444)){throw 'Only the isolated HTTPS test endpoints are allowed.'}
    Add-Type -AssemblyName System.Net.Http
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    $handler=New-Object Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect=$false;$handler.UseProxy=$false
    $client=New-Object Net.Http.HttpClient($handler)
    $client.Timeout=[TimeSpan]::FromSeconds(5)
    try {
        $response=$client.GetAsync($Url).GetAwaiter().GetResult()
        try{return [pscustomobject]@{Status=[int]$response.StatusCode;Location=[string]$response.Headers.Location;Body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()}}finally{$response.Dispose()}
    }finally{$client.Dispose();$handler.Dispose()}
}
function Test-WmsTestInput($Value) {
    foreach($name in @('Company','Warehouse','Location','Name','Email','Password')) {
        $text=[string]$Value.$name
        if([string]::IsNullOrWhiteSpace($text) -or $text -match '[\x00-\x1f]' -or $text.Length -gt 200){throw ('Invalid '+$name)}
    }
    foreach($name in @('Company','Warehouse','Location','Name','Email')){$Value.$name=([string]$Value.$name).Trim()}
    $address=$null
    try{$address=New-Object System.Net.Mail.MailAddress([string]$Value.Email)}catch{throw 'Invalid Email'}
    if($address.Address -ne $Value.Email -or $Value.Email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$'){throw 'Invalid Email'}
    if($Value.Password.Length -lt 12 -or $Value.Password.Length -gt 128){throw 'Password must contain 12 to 128 characters'}
    if($Value.Location.Length -gt 100 -or $Value.Location.Contains('|') -or $Value.Location -in @('Receiving','QC','Staging')){throw 'Invalid Location'}
}
function New-WmsTestSecret {
    $bytes=New-Object byte[] 32
    $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
    return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
}
function New-WmsTestSecrets {
    [pscustomobject]@{Database=(New-WmsTestSecret);Migration=(New-WmsTestSecret);IdentityDatabase=(New-WmsTestSecret);Cluster=(New-WmsTestSecret);Oidc=(New-WmsTestSecret);Provisioning=(New-WmsTestSecret);Certificate=(New-WmsTestSecret);Recovery=(New-WmsTestSecret);Subject=[guid]::NewGuid().ToString();ProvisioningSubject=[guid]::NewGuid().ToString()}
}
function New-WmsTestRealm($Value,$Secrets) {
    Test-WmsTestInput $Value
    $profile=Get-WmsTestProfile
    return @{
        realm=$profile.Realm;enabled=$true;displayName=$Value.Company;sslRequired='all';registrationAllowed=$false;resetPasswordAllowed=$false;bruteForceProtected=$true;loginWithEmailAllowed=$true
        clients=@(
            @{clientId='inventory-wms-test';enabled=$true;protocol='openid-connect';publicClient=$false;secret=$Secrets.Oidc;standardFlowEnabled=$true;directAccessGrantsEnabled=$false;serviceAccountsEnabled=$false;redirectUris=@($profile.Origin+'/signin-oidc');webOrigins=@($profile.Origin);attributes=@{'pkce.code.challenge.method'='S256';'post.logout.redirect.uris'=($profile.Origin+'/signout-callback-oidc')};defaultClientScopes=@('web-origins','acr','profile','roles','email')},
            @{clientId='wms-provisioning';enabled=$true;protocol='openid-connect';publicClient=$false;secret=$Secrets.Provisioning;standardFlowEnabled=$false;directAccessGrantsEnabled=$false;serviceAccountsEnabled=$true}
        )
        users=@(
            @{id=$Secrets.Subject;username=$Value.Email;email=$Value.Email;firstName=($Value.Name -split '\s+',2)[0];lastName=$(if(($Value.Name -split '\s+',2).Count -gt 1){($Value.Name -split '\s+',2)[1]}else{''});enabled=$true;emailVerified=$true;requiredActions=@();credentials=@(@{type='password';value=$Value.Password;temporary=$false})},
            @{id=$Secrets.ProvisioningSubject;username='service-account-wms-provisioning';enabled=$true;serviceAccountClientId='wms-provisioning';clientRoles=@{'realm-management'=@('query-users','view-users','manage-users')}}
        )
    }
}
function New-WmsTestConfiguration($Value,$Secrets,[string]$InstallDir,[string]$DataDir) {
    Test-WmsTestInput $Value
    $profile=Get-WmsTestProfile
    return @{
        WindowsService=@{Name='InventoryWmsTest.Api'}
        ConnectionStrings=@{Wms=('Host=127.0.0.1;Port=5544;Database=wms_test;Username=wms_app;Password='+$Secrets.Database)}
        Company=@{Name=$Value.Company}
        Setup=@{Enabled=$false}
        Oidc=@{Authority=($profile.IdentityOrigin+'/realms/'+$profile.Realm);ClientId='inventory-wms-test';ClientSecret=$Secrets.Oidc}
        IdentityProvisioning=@{ClientId='wms-provisioning';ClientSecret=$Secrets.Provisioning;ReturnUrl=($profile.Origin+'/')}
        Kestrel=@{Endpoints=@{Https=@{Url=$profile.Origin;Certificate=@{Path=(Join-Path $DataDir 'certificates\localhost.pfx');Password=$Secrets.Certificate}}}}
        AllowedHosts='127.0.0.1';Hosting=@{DirectHttps=$true;ServeFrontend=$true}
        DataProtection=@{KeyPath=(Join-Path $DataDir 'keys')}
        Database=@{MigrateOnStartup=$false};Development=@{EnableDemoAuth=$false;SeedDemo=$false}
        Erp=@{Enabled=$false;DispatchPaused=$true};Health=@{HeartbeatPath=(Join-Path $DataDir 'worker-state\heartbeat.json')}
        Logging=@{LogLevel=@{Default='Information';'Microsoft.AspNetCore'='Warning';'Microsoft.EntityFrameworkCore.Database.Command'='Warning'}}
    }
}

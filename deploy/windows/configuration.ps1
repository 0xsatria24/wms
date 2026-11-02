$ErrorActionPreference = 'Stop'
function Read-WmsClientConfiguration([string]$ConfigPath) {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    foreach ($value in @($config.ConnectionStrings.Wms, $config.Company.Name, $config.Oidc.Authority, $config.Oidc.ClientId, $config.Oidc.ClientSecret, $config.PostgreSqlService, $config.PostgreSqlBin)) {
        if ([string]::IsNullOrWhiteSpace($value) -or $value -match 'REPLACE_ME') { throw 'Complete all required client configuration values.' }
    }
    $authority = $null
    if (-not [Uri]::TryCreate($config.Oidc.Authority, [UriKind]::Absolute, [ref]$authority) -or $authority.Scheme -ne 'https') { throw 'OIDC Authority must use HTTPS.' }
    $endpoint = $null
    if (-not [Uri]::TryCreate($config.Kestrel.Endpoints.Https.Url, [UriKind]::Absolute, [ref]$endpoint) -or $endpoint.Scheme -ne 'https' -or $endpoint.Host -ne 'localhost' -or $endpoint.AbsolutePath -ne '/' -or $endpoint.Query -or $endpoint.UserInfo) { throw 'Windows local hosting requires an https://localhost:PORT endpoint.' }
    if ($config.AllowedHosts -ne 'localhost' -or $config.Hosting.DirectHttps -ne $true -or $config.Hosting.ServeFrontend -ne $true) { throw 'Enable direct HTTPS/frontend hosting and set AllowedHosts to localhost.' }
    if ($config.Development.EnableDemoAuth -or $config.Development.SeedDemo -or $config.Database.MigrateOnStartup) { throw 'Demo authentication, demo seeding and automatic migrations must be disabled.' }
    if ($config.PSObject.Properties.Name -contains 'deployment-config') { throw 'Nested deployment configuration is not supported.' }
    if (@($config.Kestrel.Endpoints.PSObject.Properties).Count -ne 1) { throw 'Only the local HTTPS endpoint is supported by this installer.' }
    if ($config.PostgreSqlService -notmatch '^[a-zA-Z0-9_.-]+$') { throw 'Invalid PostgreSQL service name.' }
    if ($config.ConnectionStrings.Wms -notmatch '(?i)(^|;)\s*Host\s*=\s*(127\.0\.0\.1|localhost)\s*(;|$)') { throw 'The Windows local option requires a loopback PostgreSQL connection.' }
    $certificate = $config.Kestrel.Endpoints.Https.Certificate
    if (-not [IO.Path]::IsPathRooted($certificate.Path) -or -not (Test-Path -LiteralPath $certificate.Path -PathType Leaf)) { throw 'Provide an existing absolute PFX certificate path.' }
    return $config
}

function Test-WmsPrerequisites($Config) {
    $postgres = Join-Path $Config.PostgreSqlBin 'postgres.exe'
    if (-not (Test-Path -LiteralPath $postgres)) { throw 'PostgreSQL binaries were not found.' }
    $version = & $postgres --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch 'PostgreSQL\) 18\.') { throw 'PostgreSQL 18 is required.' }
    $service = Get-CimInstance Win32_Service -Filter "Name='$($Config.PostgreSqlService)'"
    if (-not $service -or $service.State -ne 'Running' -or $service.PathName.IndexOf($Config.PostgreSqlBin, [StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'The selected PostgreSQL 18 service must be installed and running.' }
    $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2($Config.Kestrel.Endpoints.Https.Certificate.Path, $Config.Kestrel.Endpoints.Https.Certificate.Password, ([Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet))
    try {
        if (-not $cert.HasPrivateKey -or $cert.NotAfter -le (Get-Date) -or $cert.NotBefore -gt (Get-Date)) { throw 'The PFX must contain a valid, unexpired private-key certificate.' }
        if ($cert.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::DnsName, $false) -ne 'localhost') { throw 'The certificate must be issued for localhost.' }
        $chain = New-Object Security.Cryptography.X509Certificates.X509Chain -ArgumentList $true
        try { if (-not $chain.Build($cert)) { throw 'The HTTPS certificate chain must be trusted by this computer.' } }
        finally { $chain.Dispose() }
    } finally { $cert.Dispose() }
}

function Assert-WmsDataPathSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $trusted = @('S-1-5-18', 'S-1-5-32-544')
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { $trusted += $identity.User.Value }
    foreach ($serviceName in @('InventoryWms.Api', 'InventoryWms.Worker')) {
        try { $trusted += (New-Object Security.Principal.NTAccount("NT SERVICE\$serviceName")).Translate([Security.Principal.SecurityIdentifier]).Value } catch { }
    }
    $root = Get-Item -LiteralPath $Path -Force
    $items = @($root) + @(Get-ChildItem -LiteralPath $Path -Recurse -Force)
    foreach ($item in $items) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse points are not allowed in the WMS data directory.' }
        $acl = Get-Acl -LiteralPath $item.FullName
        if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $trusted) { throw 'The existing WMS data directory has an untrusted owner. Administrator remediation is required.' }
        foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
            if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin $trusted) { throw 'The existing WMS data directory has untrusted permissions. Administrator remediation is required.' }
        }
    }
}

function Set-WmsPrivateDirectory([string]$Path) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
    foreach ($item in @(Get-ChildItem -LiteralPath $Path -Recurse -Force)) {
        $childAcl = if ($item.PSIsContainer) { New-Object Security.AccessControl.DirectorySecurity } else { New-Object Security.AccessControl.FileSecurity }
        $childAcl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
        $childAcl.SetAccessRuleProtection($false, $false)
        Set-Acl -LiteralPath $item.FullName -AclObject $childAcl
    }
}

function Invoke-WmsSc([string[]]$ScArguments) {
    & "$env:SystemRoot\System32\sc.exe" @ScArguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Service configuration failed ($($ScArguments[0]))." }
}

function Assert-WmsServicePath([string]$Name, [string]$Executable) {
    $service = Get-CimInstance Win32_Service -Filter "Name='$Name'"
    if ($service -and -not $service.PathName.StartsWith(('"' + $Executable + '" '), [StringComparison]::OrdinalIgnoreCase)) { throw "Service $Name belongs to another installation; no changes made." }
    return $service
}

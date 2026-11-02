$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $repoRoot 'deploy/windows/configuration.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('wms-config-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $certificate = Join-Path $testRoot 'test.pfx'
    Set-Content -LiteralPath $certificate -Value 'Fixture: parsing only, not a certificate.'
    $baseline = (Get-Content (Join-Path $repoRoot 'deploy/windows/client-config.example.json') -Raw).Replace('REPLACE_ME', 'fixture') | ConvertFrom-Json
    $baseline.Kestrel.Endpoints.Https.Certificate.Path = $certificate
    $configFile = Join-Path $testRoot 'client.json'
    $baseline | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configFile
    $parsed = Read-WmsClientConfiguration $configFile
    if ($parsed.Kestrel.Endpoints.Https.Url -ne 'https://localhost:5443') { throw 'Valid configuration did not load.' }
    $cases = @(
        @{ Name='HTTP listener'; Change={ param($c) $c.Kestrel.Endpoints.Https.Url='http://localhost:5443' } },
        @{ Name='LAN listener'; Change={ param($c) $c.Kestrel.Endpoints.Https.Url='https://0.0.0.0:5443' } },
        @{ Name='Demo login'; Change={ param($c) $c.Development.EnableDemoAuth=$true } },
        @{ Name='Automatic migration'; Change={ param($c) $c.Database.MigrateOnStartup=$true } },
        @{ Name='Placeholder secrets'; Change={ param($c) $c.Oidc.ClientSecret='REPLACE_ME' } },
        @{ Name='Insecure identity provider'; Change={ param($c) $c.Oidc.Authority='http://identity.example' } },
        @{ Name='Remote database'; Change={ param($c) $c.ConnectionStrings.Wms='Host=db.example;Database=wms;Username=wms;Password=fixture' } },
        @{ Name='Additional listener'; Change={ param($c) $c.Kestrel.Endpoints | Add-Member -NotePropertyName Http -NotePropertyValue @{Url='http://0.0.0.0:80'} } }
    )
    foreach ($case in $cases) {
        $value = $baseline | ConvertTo-Json -Depth 20 | ConvertFrom-Json
        & $case.Change $value
        $value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configFile
        $rejected = $false
        try { $null = Read-WmsClientConfiguration $configFile } catch { $rejected = $true }
        if (-not $rejected) { throw "Unsafe configuration was accepted: $($case.Name)" }
    }
    foreach ($script in @('deploy/windows/configuration.ps1','deploy/windows/install-services.ps1','deploy/windows/uninstall-services.ps1','scripts/build-windows.ps1')) {
        $parseErrors = $null
        [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot $script), [ref]$null, [ref]$parseErrors) | Out-Null
        if ($parseErrors) { throw "Invalid PowerShell syntax: $script" }
    }
    $openDirectory = Join-Path $testRoot 'untrusted-data'
    New-Item -ItemType Directory -Path $openDirectory | Out-Null
    $openAcl = Get-Acl -LiteralPath $openDirectory
    $openAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')), 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    Set-Acl -LiteralPath $openDirectory -AclObject $openAcl
    $unsafeRejected = $false
    try { Assert-WmsDataPathSafe $openDirectory } catch {
        if ($_.Exception.Message -notmatch 'untrusted') { throw }
        $unsafeRejected = $true
    }
    if (-not $unsafeRejected) { throw 'A data directory accessible to ordinary users was accepted.' }
    Write-Host 'PASS: valid configuration, 8 rejected unsafe configurations, untrusted data-directory rejection, 4 PowerShell syntax checks.'
} finally {
    $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
    if (-not $resolvedTestRoot.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedTestRoot -Leaf) -notlike 'wms-config-test-*') { throw 'Refusing cleanup outside the test temp directory.' }
    Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
}

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\deploy\windows\configuration.ps1')
$script:privateCalls = 0
# Exercise provisioning decisions without changing machine ACLs or services.
function Set-WmsPrivateDirectory([string]$Path) { $script:privateCalls++ }
function New-TestConfig { return ('{"Setup":{"Enabled":false,"CodeHash":"","ExpiresAt":"","Warehouse":{"Id":"main","Name":"Test warehouse","StorageLocations":["A"]}}}' | ConvertFrom-Json) }
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('wms-installer-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $config = New-TestConfig
    Initialize-WmsSetup $config $testRoot 'empty'
    $codePath = Join-Path $testRoot 'secrets\setup-code.txt'
    $code = Get-Content -LiteralPath $codePath -Raw
    if ($code -notmatch '^[a-zA-Z0-9_-]{43}$' -or -not $config.Setup.Enabled -or $script:privateCalls -ne 1) { throw 'Initial activation generation failed.' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $expected = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($code))).Replace('-','') } finally { $sha.Dispose() }
    if ($config.Setup.CodeHash -ne $expected) { throw 'Activation hash does not match private file.' }
    $expiry = [DateTimeOffset]::Parse($config.Setup.ExpiresAt)
    if ($expiry -lt [DateTimeOffset]::UtcNow.AddHours(23) -or $expiry -gt [DateTimeOffset]::UtcNow.AddHours(25)) { throw 'Unexpected expiry.' }
    $retry = New-TestConfig
    Initialize-WmsSetup $retry $testRoot 'empty'
    if ((Get-Content -LiteralPath $codePath -Raw) -ne $code -or $retry.Setup.CodeHash -ne $expected) { throw 'Interrupted install rotated the code.' }
    $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $testRoot 'appsettings.client.json')
    $upgrade = New-TestConfig
    Initialize-WmsSetup $upgrade $testRoot 'initialized'
    if ($upgrade.Setup.CodeHash -ne $expected -or $upgrade.Setup.ExpiresAt -ne $config.Setup.ExpiresAt) { throw 'Upgrade overwrote installed activation.' }
    Remove-Item -LiteralPath (Join-Path $testRoot 'appsettings.client.json'), $codePath
    $initialized = New-TestConfig
    Initialize-WmsSetup $initialized $testRoot 'initialized'
    if (Test-Path -LiteralPath $codePath) { throw 'Initialized database generated a new code.' }
    $invalid = New-TestConfig; $invalid.Setup.Warehouse.Id = ''
    $rejected = $false
    try { Initialize-WmsSetup $invalid $testRoot 'empty' } catch { $rejected = $true }
    if (-not $rejected -or (Test-Path -LiteralPath $codePath)) { throw 'Invalid provisioning generated activation.' }
    Write-Output 'PASS: new installation, matching hash/expiry, private-directory call, interrupted retry, upgrade preservation, initialized database and missing warehouse.'
} finally {
    foreach ($file in @('secrets\setup-code.txt', 'appsettings.client.json')) {
        $target = Join-Path $testRoot $file
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target }
    }
    Remove-Item -LiteralPath (Join-Path $testRoot 'secrets') -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $testRoot
}

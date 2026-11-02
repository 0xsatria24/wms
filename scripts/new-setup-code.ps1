param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(1,168)][int]$ValidHours = 24
)
$ErrorActionPreference = 'Stop'
$outputPath = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $outputPath) { throw 'Output directory must be new; provisioning files will not be overwritten.' }
New-Item -ItemType Directory -Path $outputPath | Out-Null
# Restrict access before writing the activation code.
$account = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $outputPath /inheritance:r /grant:r ('*' + $account + ':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict directory; no code was written.' }
$bytes = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
$code = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$sha = [Security.Cryptography.SHA256]::Create()
try { $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($code))).Replace('-','') } finally { $sha.Dispose() }
@{ Setup = @{ Enabled = $true; CodeHash = $hash; ExpiresAt = [DateTimeOffset]::UtcNow.AddHours($ValidHours).ToString('O') } } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputPath 'setup-config.json') -Encoding UTF8
$code | Set-Content -LiteralPath (Join-Path $outputPath 'activation-code.txt') -Encoding ASCII
Write-Host 'Private provisioning files created. Merge Setup into API configuration and deliver activation-code.txt privately. Do not commit these files.'

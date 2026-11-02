param([Parameter(Mandatory=$true)][string]$PayloadDir)
$ErrorActionPreference = 'Stop'
$PayloadDir = [IO.Path]::GetFullPath($PayloadDir)
$repoRoot = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path $repoRoot ('.runtime\windows-smoke-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$api = $null
$worker = $null
$rsa = [Security.Cryptography.RSA]::Create(2048)
try {
    $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost', $rsa, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $san = [Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $san.AddDnsName('localhost')
    $request.CertificateExtensions.Add($san.Build())
    $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1), [DateTimeOffset]::UtcNow.AddHours(1))
    $certPath = Join-Path $testRoot 'fixture.pfx'
    try { [IO.File]::WriteAllBytes($certPath, $certificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, 'fixture-only')) }
    finally { $certificate.Dispose() }
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    $heartbeat = Join-Path $testRoot 'heartbeat.json'
    $configPath = Join-Path $testRoot 'fixture.json'
    @{
        ConnectionStrings=@{Wms='Host=127.0.0.1;Port=1;Database=unused;Username=unused;Timeout=1'}
        Oidc=@{Authority='https://identity.example';ClientId='fixture'}
        AllowedHosts='localhost'
        Hosting=@{DirectHttps=$true;ServeFrontend=$true}
        DataProtection=@{KeyPath=(Join-Path $testRoot 'keys')}
        Database=@{MigrateOnStartup=$false}
        Development=@{EnableDemoAuth=$false;SeedDemo=$false}
        Kestrel=@{Endpoints=@{Https=@{Url="https://localhost:$port";Certificate=@{Path=$certPath;Password='fixture-only'}}}}
        Erp=@{Enabled=$false;DispatchPaused=$true}
        Health=@{HeartbeatPath=$heartbeat}
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath
    foreach ($component in @('api','worker')) {
        $exe = Join-Path $PayloadDir "$component\Wms.$((Get-Culture).TextInfo.ToTitleCase($component)).exe"
        $arguments = @('--environment','Production','--contentRoot',('"' + (Split-Path $exe -Parent) + '"'),'--deployment-config',('"' + $configPath + '"'))
        $process = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory (Split-Path $exe -Parent) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "$component.stdout.log") -RedirectStandardError (Join-Path $testRoot "$component.stderr.log")
        if ($component -eq 'api') { $api = $process } else { $worker = $process }
    }
    $bodyFile = Join-Path $testRoot 'response.txt'
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        # The one-hour fixture certificate is intentionally not added to any trust store.
        $code = & curl.exe --noproxy '*' --insecure --silent --max-time 2 --output $bodyFile --write-out '%{http_code}' "https://localhost:$port/stock"
        if ($LASTEXITCODE -eq 0 -and $code -eq '200') { $ready=$true; break }
        if ($api.HasExited) { throw 'Published API exited unexpectedly; inspect smoke logs.' }
        Start-Sleep -Seconds 1
    }
    if (-not $ready -or (Get-Content $bodyFile -Raw) -notmatch 'id="root"') { throw 'Published frontend SPA did not load.' }
    foreach ($path in @('/api/missing','/auth/missing','/health/missing','/hubs/missing','/api/dev/login')) {
        $code = & curl.exe --noproxy '*' --insecure --silent --max-time 5 --output $bodyFile --write-out '%{http_code}' "https://localhost:$port$path"
        if ($LASTEXITCODE -ne 0 -or $code -ne '404') { throw "Unexpected route response for $path : $code" }
    }
    $code = & curl.exe --noproxy '*' --insecure --silent --max-time 5 --output $bodyFile --write-out '%{http_code}' "https://localhost:$port/api/session"
    if ($LASTEXITCODE -ne 0 -or $code -ne '200' -or (Get-Content $bodyFile -Raw | ConvertFrom-Json).mode -ne 'oidc') { throw 'Published package did not run with production OIDC.' }
    if (-not (Test-Path -LiteralPath $heartbeat) -or (Get-Content $heartbeat -Raw | ConvertFrom-Json).status -ne 'disabled') { throw 'Published worker did not write its heartbeat.' }
    Write-Host "PASS: self-contained API HTTPS/SPA/reserved routes/OIDC mode and worker heartbeat. Fixture only; no service install, trust-store change, database or SSO login. Logs: $testRoot"
} finally {
    foreach ($process in @($worker,$api)) { if ($process -and -not $process.HasExited) { Stop-Process -InputObject $process -ErrorAction SilentlyContinue } }
    $rsa.Dispose()
}

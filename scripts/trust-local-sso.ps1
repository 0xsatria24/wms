param([switch]$Machine)
$ErrorActionPreference='Stop'
$private=Join-Path (Split-Path -Parent $PSScriptRoot) '.runtime\local-sso'
$runtime=Get-Content -LiteralPath (Join-Path $private 'runtime.json') -Raw | ConvertFrom-Json
$cert=[Security.Cryptography.X509Certificates.X509Certificate2]::new((Join-Path $private 'localhost.cer'))
try {
 if($cert.Thumbprint -ne $runtime.CertificateThumbprint -or $cert.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::DnsName,$false) -ne 'localhost' -or $cert.NotAfter -lt (Get-Date)) {throw 'Unexpected localhost certificate; no trust change made.'}
 $constraints=$cert.Extensions | Where-Object {$_.Oid.Value -eq '2.5.29.19'}
 if(-not $constraints -or $constraints.CertificateAuthority){throw 'Only the prepared non-CA localhost server certificate is allowed.'}
 $location=if($Machine){[Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine}else{[Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser}
 $store=[Security.Cryptography.X509Certificates.X509Store]::new([Security.Cryptography.X509Certificates.StoreName]::Root,$location)
 try{$store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite);$store.Add($cert)}finally{$store.Dispose()}
 Write-Output "Trusted localhost-only server certificate $($cert.Thumbprint) in $location. Expires $($cert.NotAfter.ToString('yyyy-MM-dd'))."
}finally{$cert.Dispose()}

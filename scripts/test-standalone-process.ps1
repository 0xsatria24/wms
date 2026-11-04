$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../deploy/windows/standalone-process.ps1')
$shell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$result=Invoke-WmsNative $shell @('-NoProfile','-Command','[Console]::Error.WriteLine("diagnostic only"); [Console]::WriteLine("done"); exit 0') 15
if($result.ExitCode -ne 0 -or $result.StandardError -notmatch 'diagnostic only' -or $result.StandardOutput -notmatch 'done'){throw 'A successful native command that writes stderr must not fail provisioning'}
$result=Invoke-WmsNative $shell @('-NoProfile','-Command','exit 7') 15
if($result.ExitCode -ne 7){throw 'Native failure exit code was lost'}
$result=Invoke-WmsNative $shell @('-NoProfile','-Command','Start-Sleep -Seconds 30') 1
if(!$result.TimedOut){throw 'Native command exceeded its deadline without being terminated'}
$clock=[Diagnostics.Stopwatch]::StartNew()
$result=Invoke-WmsNative $shell @('-NoProfile','-Command','Start-Process ping.exe -ArgumentList @("-n","5","127.0.0.1") -NoNewWindow; exit 0') 1
if($clock.Elapsed.TotalSeconds -gt 15){throw 'Inherited output handles must not defeat the command deadline'}
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('wms-native-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture|Out-Null
$batch=Join-Path $fixture 'probe with spaces.cmd'
try{
    @('@echo off','echo %~1','echo batch diagnostic 1>&2','exit /b 0')|Set-Content -LiteralPath $batch -Encoding ASCII
    $result=Invoke-WmsNative $batch @('argument with spaces') 15
    if($result.ExitCode -ne 0 -or $result.StandardOutput -notmatch 'argument with spaces' -or $result.StandardError -notmatch 'batch diagnostic'){throw 'Batch-file quoting or stderr capture failed'}
}finally{Remove-Item -LiteralPath $batch -Force;[IO.Directory]::Delete($fixture)}
'PASS: native stderr capture, exit code preservation, command quoting and bounded timeout.'

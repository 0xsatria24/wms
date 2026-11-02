$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sonarHome = Join-Path $projectRoot '.tools\sonarqube\sonarqube-26.10.0.133078'
$javaPath = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot\bin\java.exe'
$serverJar = Join-Path $sonarHome 'lib\sonar-application-26.10.0.133078.jar'
$runtimePath = Join-Path $projectRoot '.runtime\sonarqube'
if (-not (Test-Path -LiteralPath $javaPath)) { throw "Java 21 JDK is missing: $javaPath" }
if (-not (Test-Path -LiteralPath $serverJar)) { throw "SonarQube is missing: $serverJar" }
try {
    $status = Invoke-RestMethod 'http://127.0.0.1:9001/api/system/status' -TimeoutSec 3
    if ($status.version -eq '26.10.0.133078') {
        Write-Output "SonarQube is already running: $($status.status)"
        exit 0
    }
    throw 'Port 9001 is occupied by a different SonarQube version.'
}
catch {
    if ($_.Exception.Message -like 'Port 9001*') { throw }
}
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$javaArguments = @(
    '-Djava.awt.headless=true',
    '--add-exports=java.base/jdk.internal.ref=ALL-UNNAMED',
    '--add-opens=java.base/java.lang=ALL-UNNAMED',
    '--add-opens=java.base/sun.nio.ch=ALL-UNNAMED',
    '--add-opens=java.management/sun.management=ALL-UNNAMED',
    '--add-opens=jdk.management/com.sun.management.internal=ALL-UNNAMED',
    '-cp', ('"' + $serverJar + '"'), 'org.sonar.application.App'
)
$serverProcess = Start-Process -FilePath $javaPath -ArgumentList $javaArguments -WorkingDirectory $sonarHome -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'launcher.out.log') -RedirectStandardError (Join-Path $runtimePath 'launcher.err.log')
$serverProcess.Id | Set-Content -LiteralPath (Join-Path $runtimePath 'server.pid')
Write-Output "Started local SonarQube (PID $($serverProcess.Id)): http://127.0.0.1:9001"

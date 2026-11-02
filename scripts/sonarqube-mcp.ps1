$projectRoot = Split-Path -Parent $PSScriptRoot
$jarPath = Join-Path $projectRoot '.tools\sonarqube\sonarqube-mcp-server-1.19.0.2785.jar'
$javaPath = 'C:\Program Files\Eclipse Adoptium\jre-21.0.13.9-hotspot\bin\java.exe'
if (-not $env:SONARQUBE_TOKEN) {
    $env:SONARQUBE_TOKEN = [Environment]::GetEnvironmentVariable('SONARQUBE_TOKEN', 'User')
}
if (-not $env:SONARQUBE_TOKEN) {
    throw 'Set SONARQUBE_TOKEN for the local SonarQube account before enabling this MCP server.'
}
$env:SONARQUBE_URL = 'http://127.0.0.1:9001'
$env:SONARQUBE_READ_ONLY = 'true'
$env:STORAGE_PATH = Join-Path $projectRoot '.runtime\sonarqube\mcp'
$env:TELEMETRY_DISABLED = 'true'
& $javaPath -jar $jarPath
exit $LASTEXITCODE

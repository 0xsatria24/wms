param([Parameter(ValueFromRemainingArguments=$true)][string[]]$DotnetArguments)
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.runtime\dotnet-home'
$env:NUGET_PACKAGES = Join-Path $projectRoot '.tools\nuget'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
$portableDotnet = Join-Path $projectRoot '.tools\dotnet\dotnet.exe'
if (Test-Path -LiteralPath $portableDotnet) { & $portableDotnet @DotnetArguments } else { & dotnet @DotnetArguments }
exit $LASTEXITCODE

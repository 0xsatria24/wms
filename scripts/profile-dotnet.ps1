param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('counters', 'trace')]
    [string]$Tool,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ToolArguments
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$profilerPath = Join-Path $projectRoot ".tools\diagnostics\dotnet-$Tool.exe"
$runtimePath = Join-Path $projectRoot '.tools\dotnet'
if (-not (Test-Path -LiteralPath $profilerPath)) {
    throw "Profiler not installed: $profilerPath"
}

$previousDotnetRoot = $env:DOTNET_ROOT
try {
    if (Test-Path -LiteralPath (Join-Path $runtimePath 'dotnet.exe')) {
        $env:DOTNET_ROOT = $runtimePath
    }
    & $profilerPath @ToolArguments
    $profilerExitCode = $LASTEXITCODE
}
finally {
    $env:DOTNET_ROOT = $previousDotnetRoot
}
exit $profilerExitCode

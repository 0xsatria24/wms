param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AxeArguments)

$projectRoot = Split-Path -Parent $PSScriptRoot
$driverPath = Join-Path $projectRoot '.tools\chromedriver\chromedriver-win64\chromedriver.exe'
if (-not (Test-Path -LiteralPath $driverPath)) {
    throw "ChromeDriver is missing: $driverPath"
}
& axe --chromedriver-path $driverPath @AxeArguments
exit $LASTEXITCODE

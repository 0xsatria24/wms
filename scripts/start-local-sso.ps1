param([switch]$ImportRealm)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$private=Join-Path $projectRoot '.runtime\local-sso'
$runtime=Get-Content -LiteralPath (Join-Path $private 'runtime.json') -Raw | ConvertFrom-Json
$env:JAVA_HOME=$runtime.JavaHome
$env:KC_HTTPS_KEY_STORE_PASSWORD=$runtime.PfxPassword
$env:KC_BOOTSTRAP_ADMIN_USERNAME=$runtime.MasterUsername
$env:KC_BOOTSTRAP_ADMIN_PASSWORD=$runtime.MasterPassword
$env:KC_DB_URL=$runtime.DbUrl
$env:KC_DB='dev-file'
$env:KC_CACHE='local'
$env:KC_HTTP_HOST='127.0.0.1'
$env:KC_HTTP_ENABLED='false'
$env:KC_HTTP_PORT='18080'
$env:KC_HTTPS_PORT='8443'
$env:KC_HOSTNAME='https://localhost:8443'
$env:KC_HTTPS_KEY_STORE_FILE=$runtime.Pfx
$env:KC_HTTPS_KEY_STORE_TYPE='PKCS12'
$kc=Join-Path $runtime.KeycloakHome 'bin\kc.bat'
if($ImportRealm){
 & $kc import --file (Join-Path $private 'wms-local-realm.json') --override false
 if($LASTEXITCODE -ne 0){throw 'Realm import failed'}
}
& $kc start
if($LASTEXITCODE -ne 0){throw 'Local SSO exited with an error'}

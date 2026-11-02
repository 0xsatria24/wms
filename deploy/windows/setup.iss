#ifndef PayloadDir
  #error Pass /DPayloadDir pointing at the published payload
#endif
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{CB1240EC-640B-4A60-962A-6F134A230A89}
AppName=Inventory WMS
AppVersion={#AppVersion}
DefaultDirName={autopf}\Inventory WMS
DefaultGroupName=Inventory WMS
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputBaseFilename=InventoryWms-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
DisableDirPage=yes
UninstallDisplayName=Inventory WMS (database retained)
SetupLogging=yes

[Files]
Source: "{#PayloadDir}\api\*"; DestDir: "{app}\api"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\worker\*"; DestDir: "{app}\worker"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\deployment\*.ps1"; DestDir: "{app}\deployment"; Flags: ignoreversion
Source: "{#PayloadDir}\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\build.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\deployment\configuration.ps1"; Flags: dontcopy
Source: "{#PayloadDir}\deployment\install-services.ps1"; Flags: dontcopy

[Icons]
Name: "{group}\Inventory WMS"; Filename: "{app}\Inventory WMS.url"
Name: "{autodesktop}\Inventory WMS"; Filename: "{app}\Inventory WMS.url"

[UninstallDelete]
Type: files; Name: "{app}\Inventory WMS.url"

[Code]
var
  ConfigPage: TInputFileWizardPage;

procedure InitializeWizard;
begin
  ConfigPage := CreateInputFilePage(wpSelectDir, 'Company configuration',
    'Select the prepared client JSON configuration',
    'PostgreSQL 18, trusted localhost HTTPS certificate, SSO callbacks and the migrated WMS database must already be prepared. Stop both WMS services before an upgrade. Database and ProgramData are retained on uninstall.');
  ConfigPage.Add('Client configuration JSON:', 'JSON files|*.json', '.json');
  ConfigPage.Values[0] := ExpandConstant('{param:CONFIG|}');
end;

function RunDeployment(Script, Parameters: String): Boolean;
var
  ExitCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + Script + '" ' + Parameters,
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Result := Result and (ExitCode = 0);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not FileExists(ConfigPage.Values[0]) then begin
    Result := 'Select an existing client configuration JSON.';
    exit;
  end;
  ExtractTemporaryFile('configuration.ps1');
  ExtractTemporaryFile('install-services.ps1');
  if not RunDeployment(ExpandConstant('{tmp}\install-services.ps1'),
    '-ValidateOnly -InstallDir "' + ExpandConstant('{app}') + '" -ConfigPath "' + ConfigPage.Values[0] + '"') then
    Result := 'Configuration/prerequisite validation failed. Run deployment\install-services.ps1 with -ValidateOnly in an Administrator PowerShell to see the error. No services were changed.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    if not RunDeployment(ExpandConstant('{app}\deployment\install-services.ps1'),
      '-InstallDir "' + ExpandConstant('{app}') + '" -ConfigPath "' + ConfigPage.Values[0] + '"') then
      RaiseException('Service setup failed. Check Windows Application events and run deployment\install-services.ps1 in Administrator PowerShell for details. Persistent data was retained.');
    if not FileExists(ExpandConstant('{app}\Inventory WMS.url')) then
      RaiseException('The application shortcut URL was not generated.');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    if not RunDeployment(ExpandConstant('{app}\deployment\uninstall-services.ps1'),
      '-InstallDir "' + ExpandConstant('{app}') + '"') then
      RaiseException('Cannot remove application services. Resolve service ownership/permissions before retrying uninstall.');
end;

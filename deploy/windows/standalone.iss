#ifndef PayloadDir
  #error Pass PayloadDir
#endif
#ifndef AppVersion
  #define AppVersion "1.1.1"
#endif
[Setup]
AppId={{E3E095A8-ACD1-45A5-AD90-455CAFD927AD}
AppName=Inventory WMS Local Test
AppVersion={#AppVersion}
DefaultDirName={autopf}\Inventory WMS Local Test
DefaultGroupName=Inventory WMS Local Test
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputBaseFilename=InventoryWms-LocalTest-Setup
Compression=lzma2/fast
SolidCompression=yes
DiskSpanning=yes
DiskSliceSize=max
WizardStyle=modern
DisableDirPage=yes
DisableProgramGroupPage=yes
SetupLogging=yes
UninstallDisplayName=Inventory WMS Local Test (data retained)
[Files]
Source: "{#PayloadDir}\deployment\configuration.ps1"; Flags: dontcopy
Source: "{#PayloadDir}\deployment\standalone-model.ps1"; Flags: dontcopy
Source: "{#PayloadDir}\deployment\standalone-process.ps1"; Flags: dontcopy
Source: "{#PayloadDir}\deployment\install-standalone.ps1"; Flags: dontcopy
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs solidbreak
[Icons]
Name: "{group}\Inventory WMS Local Test"; Filename: "{app}\launcher\InventoryWms.exe"
Name: "{autodesktop}\Inventory WMS Local Test"; Filename: "{app}\launcher\InventoryWms.exe"
[UninstallDelete]
Type: files; Name: "{app}\Inventory WMS Local Test.url"
Type: files; Name: "{app}\dependencies\service\IdentityService.xml"
[Code]
var
  CompanyPage, AccountPage: TInputQueryWizardPage;
procedure DeploymentLog(const S: String; const Error, FirstLine: Boolean);
begin
  if (Pos('WMS_STAGE:', S) = 1) and not Error then begin
    WizardForm.StatusLabel.Caption := Copy(S, 11, Length(S));
    WizardForm.FilenameLabel.Caption := 'Configuring services. Please keep this window open.';
    WizardForm.StatusLabel.Update;
    WizardForm.FilenameLabel.Update;
    if Pos('Initialize independent', S) > 0 then WizardForm.ProgressGauge.Position := 10;
    if Pos('Register database', S) > 0 then WizardForm.ProgressGauge.Position := 25;
    if Pos('Create isolated', S) > 0 then WizardForm.ProgressGauge.Position := 35;
    if Pos('Migrate local', S) > 0 then WizardForm.ProgressGauge.Position := 45;
    if Pos('Create first', S) > 0 then WizardForm.ProgressGauge.Position := 55;
    if Pos('Import new', S) > 0 then WizardForm.ProgressGauge.Position := 65;
    if Pos('Starting sign-in', S) > 0 then WizardForm.ProgressGauge.Position := 80;
    if Pos('Starting WMS', S) > 0 then WizardForm.ProgressGauge.Position := 90;
    if Pos('verified complete', S) > 0 then WizardForm.ProgressGauge.Position := 100;
    Log(S);
  end else if Trim(S) <> '' then Log(S);
end;
function Deploy(Script, Parameters: String): Boolean;
var Code: Integer;
begin
  if IsWin64 then EnableFsRedirection(False);
  try
    Result := ExecAndLogOutput(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + Script + '" -InstallDir "' + ExpandConstant('{app}') + '" ' + Parameters,
      '', SW_HIDE, ewWaitUntilTerminated, Code, @DeploymentLog);
  finally
    if IsWin64 then EnableFsRedirection(True);
  end;
  Result := Result and (Code = 0);
end;
function Json(Value: String): String;
begin
  StringChangeEx(Value, '\', '\\', True);
  StringChangeEx(Value, '"', '\"', True);
  StringChangeEx(Value, #13, '\r', True);
  StringChangeEx(Value, #10, '\n', True);
  StringChangeEx(Value, #9, '\t', True);
  Result := '"' + Value + '"';
end;
procedure InitializeWizard;
begin
  CompanyPage := CreateInputQueryPage(wpWelcome, 'Local test installation', 'One PC with independent data and login',
    'Installs PostgreSQL, Java, Keycloak and WMS as automatic services. Creates and trusts a certificate for 127.0.0.1 on this PC. This test installation does not share data with the existing WMS. Email delivery requires later SMTP configuration.');
  CompanyPage.Add('Company name:', False);
  CompanyPage.Add('Initial warehouse name:', False);
  CompanyPage.Add('First storage location (for example A-01):', False);
  AccountPage := CreateInputQueryPage(CompanyPage.ID, 'First administrator', 'Choose your account and password',
    'This account belongs only to this local test installation. Email is accepted locally; no verification email is sent. Use at least 12 characters for the password.');
  AccountPage.Add('Administrator name:', False);
  AccountPage.Add('Email:', False);
  AccountPage.Add('Password:', True);
  AccountPage.Add('Repeat password:', True);
end;
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if ExpandConstant('{param:INPUT|}') <> '' then exit;
  if CurPageID = CompanyPage.ID then
    if (Trim(CompanyPage.Values[0]) = '') or (Trim(CompanyPage.Values[1]) = '') or (Trim(CompanyPage.Values[2]) = '') then begin
      MsgBox('Fill in company, warehouse and storage location.', mbError, MB_OK); Result := False;
    end;
  if CurPageID = AccountPage.ID then
    if (Trim(AccountPage.Values[0]) = '') or (Pos('@', AccountPage.Values[1]) = 0) or (Length(AccountPage.Values[2]) < 12) or (AccountPage.Values[2] <> AccountPage.Values[3]) then begin
      MsgBox('Fill in your name and email, then enter matching passwords of at least 12 characters.', mbError, MB_OK); Result := False;
    end;
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  ExtractTemporaryFile('configuration.ps1');
  ExtractTemporaryFile('standalone-model.ps1');
  ExtractTemporaryFile('standalone-process.ps1');
  ExtractTemporaryFile('install-standalone.ps1');
  Result := '';
  if not Deploy(ExpandConstant('{tmp}\install-standalone.ps1'), '-ValidateOnly') then
    Result := 'Preflight failed. Ports 5444, 5544, 8444 and 9004 must be free. Stop only InventoryWmsTest services before reinstalling. Existing data is not reset.';
end;
procedure CurStepChanged(CurStep: TSetupStep);
var InputPath, Text: String; Lines: TArrayOfString;
begin
  if CurStep = ssPostInstall then begin
    WizardForm.StatusLabel.Caption := 'Configuring the database and sign-in service...';
    WizardForm.ProgressGauge.Min := 0;
    WizardForm.ProgressGauge.Max := 100;
    WizardForm.ProgressGauge.Position := 0;
    WizardForm.StatusLabel.Update;
    if not Deploy(ExpandConstant('{app}\deployment\install-standalone.ps1'), '-PrepareInput') then
      RaiseException('Cannot prepare private installation input. No account password was saved.');
    InputPath := ExpandConstant('{commonappdata}\InventoryWmsLocalTest\setup-input.json');
    if ExpandConstant('{param:INPUT|}') <> '' then begin
      { Local automated tests supply an administrator-only file, never passwords on the command line. }
      if not FileCopy(ExpandConstant('{param:INPUT|}'), InputPath, False) then RaiseException('Cannot copy private test input.');
    end else begin
      Text := '{"Company":'+Json(CompanyPage.Values[0])+',"Warehouse":'+Json(CompanyPage.Values[1])+',"Location":'+Json(CompanyPage.Values[2])+',"Name":'+Json(AccountPage.Values[0])+',"Email":'+Json(AccountPage.Values[1])+',"Password":'+Json(AccountPage.Values[2])+'}';
      SetArrayLength(Lines, 1); Lines[0] := Text;
      if not SaveStringsToUTF8File(InputPath, Lines, False) then RaiseException('Cannot save private installation input.');
    end;
    if not Deploy(ExpandConstant('{app}\deployment\install-standalone.ps1'), '-InputPath "'+InputPath+'"') then
      RaiseException('Local Test setup failed. Inspect C:\ProgramData\InventoryWmsLocalTest\installation.log as Administrator. Existing WMS was not changed.');
  end;
end;
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then WizardForm.FinishedLabel.Caption := 'Local test installation verified. Open the Inventory WMS Local Test shortcut and sign in with the administrator email and password you chose. SMTP email is not configured. Data is retained on uninstall.';
end;
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    if not Deploy(ExpandConstant('{app}\deployment\uninstall-standalone.ps1'), '') then
      RaiseException('Cannot remove owned test services. Resolve this before retrying uninstall. Data was not removed.');
end;

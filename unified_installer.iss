; Script generated for I2V Unified Installer
; Silent installation with progress page

#define MyAppName "I2V Unified System"
#define MyAppVersion "1.0.3"
#define MyAppPublisher "I2V systems"
#define MyAppExeName "i2v-ingestion-service.exe"

[Setup]
AppId={{C19C2C72-C318-4BB3-8A8B-5F3B0DF27EC7}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={commonpf}\i2v-MQTT-Ingestion
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=C:\Users\mevis\MQTT-Ingetsion
OutputBaseFilename=I2V-Dashboard-Installer
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Copy the ENTIRE Optimized Release folder
Source: "dist\I2V_Smart_City_Release_v1.0.2\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\I2V Config UI"; Filename: "http://localhost:3001"; IconFilename: "{app}\client\dist\i2v-icon.ico"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{group}\Update Services"; Filename: "{app}\update_services.bat"
Name: "{group}\Fix Permissions"; Filename: "{app}\fix_permissions.bat"

[Run]
; Run VC++ redistributable install silently
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Visual C++ Redistributable (Required for Database)..."; Flags: waituntilterminated runhidden shellexec

; Run install script hidden - no terminal window shown
Filename: "{app}\install.bat"; StatusMsg: "Installing I2V Services - Please wait..."; Flags: waituntilterminated runhidden shellexec

[UninstallRun]
; Run uninstall script before removing files
Filename: "{app}\uninstall.bat"; Flags: waituntilterminated runhidden shellexec

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox('Installation completed successfully!' + #13#10 + #13#10 + 
           'Services installed:' + #13#10 +
           '  - PostgreSQL Database' + #13#10 +
           '  - MQTT Ingestion Service' + #13#10 +
           '  - Config UI (http://localhost:3001)' + #13#10 +
           '  - InfluxDB 3.0' + #13#10 +
           '  - Telegraf Monitoring' + #13#10 + #13#10 +
           'You can access the Config UI at: http://localhost:3001', 
           mbInformation, MB_OK);
  end;
end;

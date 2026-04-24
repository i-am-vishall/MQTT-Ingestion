
[Setup]
AppName=I2V Smart City Ingestion
AppVersion=9.0
DefaultDirName={commonpf32}\I2V-Smart-Ingestion
DefaultGroupName=I2V Smart City Ingestion
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=C:\\Users\\mevis\\MQTT-Ingetsion
OutputBaseFilename=I2V_Ultimate_Installer_v9.0
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "C:\\Users\\mevis\\MQTT-Ingetsion\\I2V_Ultimate_Deployment_v9.0\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{app}\INSTALL_EVERYTHING.bat"; StatusMsg: "Installing Services & Initializing Databases..."; Flags: waituntilterminated runhidden; WorkingDir: "{app}"

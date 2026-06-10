#define AppName "ChessPrep Lab"
#define AppVersion "1.0.0"
#define AppPublisher "ChessPrep Lab"
#define AppExeName "start-trainer.ps1"

[Setup]
AppId={{9B12E11D-2D9D-4F28-9093-70C3E56E7C44}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\ChessPrep Lab
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableReadyPage=yes
OutputDir=..\..\dist\installer
OutputBaseFilename=ChessPrep-Lab-Setup
Compression=lzma2/ultra64
SolidCompression=yes
SetupIconFile=..\package\app\assets\icons\chessprep-lab.ico
UninstallDisplayIcon={app}\assets\icons\chessprep-lab.ico
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern
WizardSmallImageFile=..\package\app\assets\icons\chessprep-lab-mark-64.png

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "..\package\app\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\ChessPrep Lab"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-trainer.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\icons\chessprep-lab.ico"
Name: "{autodesktop}\ChessPrep Lab"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-trainer.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\icons\chessprep-lab.ico"; Tasks: desktopicon

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\start-trainer.ps1"""; WorkingDir: "{app}"; Description: "Launch ChessPrep Lab"; Flags: nowait postinstall skipifsilent

$ErrorActionPreference = 'Stop'

$InstallerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $InstallerRoot
$PayloadRoot = Join-Path $InstallerRoot 'package\app'
$Validator = Join-Path $ProjectRoot 'tools\installer\validate-offline-payload.mjs'
$InnoScript = Join-Path $InstallerRoot 'inno\ChessPrepLab.iss'
$OutputDir = Join-Path $ProjectRoot 'dist\installer'
$OutputExe = Join-Path $OutputDir 'ChessPrep-Lab-Setup.exe'

function Find-InnoCompiler {
  $candidates = @(
    $env:ISCC_EXE,
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe')
  ) | Where-Object { $_ }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  return $null
}

if (-not (Test-Path $Validator)) {
  throw "Offline payload validator not found: $Validator"
}

if (-not (Test-Path $InnoScript)) {
  throw "Inno Setup script not found: $InnoScript"
}

& node $Validator $PayloadRoot
if ($LASTEXITCODE -ne 0) {
  throw "Offline payload validation failed."
}

$iscc = Find-InnoCompiler
if (-not $iscc) {
  throw "ISCC.exe not found. Install Inno Setup 6 or set ISCC_EXE to the ISCC.exe path."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
& $iscc $InnoScript
if ($LASTEXITCODE -ne 0) {
  throw "Inno Setup compile failed with exit code: $LASTEXITCODE"
}

if (-not (Test-Path $OutputExe)) {
  throw "Inno Setup finished but output file was not found: $OutputExe"
}

Write-Host "ChessPrep Lab full offline installer built:"
Write-Host $OutputExe

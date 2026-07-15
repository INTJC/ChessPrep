param(
  [ValidateSet('23m', '79m')]
  [string]$MaiaModel = '23m'
)

$ErrorActionPreference = 'Stop'

$InstallerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $InstallerRoot
$FallbackPayloadRoot = Join-Path $InstallerRoot 'package\app'
$PayloadRoot = Join-Path $InstallerRoot 'package-release\app'
$Validator = Join-Path $ProjectRoot 'tools\installer\validate-offline-payload.mjs'
$InnoScript = Join-Path $InstallerRoot 'inno\ChessPrepLabRelease.iss'
$OutputDir = Join-Path $ProjectRoot 'dist\installer-release'
$OutputBaseFilename = if ($MaiaModel -eq '79m') { 'ChessPrep-Lab-Maia3-79M-Setup' } else { 'ChessPrep-Lab-Setup' }
$OutputExe = Join-Path $OutputDir "$OutputBaseFilename.exe"
$Utf8NoBom = [System.Text.Encoding]::UTF8

$ReleaseItems = @(
  'index.html',
  'app.js',
  'styles.css',
  'i18n.js',
  'server.mjs',
  'engine-profiles.mjs',
  'endgames.js',
  'endgame-expansion-lessons.js',
  'start-trainer.ps1',
  'assets',
  'data',
  'engines',
  'runtime'
)

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

function Copy-ReleaseItem {
  param([string]$Item)

  $source = Join-Path $ProjectRoot $Item
  if (-not (Test-Path $source)) {
    $source = Join-Path $FallbackPayloadRoot $Item
  }

  if (-not (Test-Path $source)) {
    throw "Release source item not found: $source"
  }

  $destination = Join-Path $PayloadRoot $Item
  if ((Get-Item $source).PSIsContainer) {
    robocopy $source $destination /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) {
      throw "robocopy failed for $Item with exit code $LASTEXITCODE"
    }
    $global:LASTEXITCODE = 0
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

function Copy-ReleasePayload {
  $packageRoot = Split-Path -Parent $PayloadRoot
  if (Test-Path $packageRoot) {
    $resolvedPackageRoot = (Resolve-Path $packageRoot).Path
    $resolvedInstallerRoot = (Resolve-Path $InstallerRoot).Path
    if (-not $resolvedPackageRoot.StartsWith($resolvedInstallerRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove unexpected path: $resolvedPackageRoot"
    }
    Remove-Item -LiteralPath $resolvedPackageRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $PayloadRoot | Out-Null

  foreach ($item in $ReleaseItems) {
    Copy-ReleaseItem -Item $item
  }
}

function Compress-JavaScript {
  param([string]$Path)

  $text = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
  $text = [regex]::Replace($text, '(?m)^\s*//.*$', '')
  $text = [regex]::Replace($text, '/\*[\s\S]*?\*/', '')
  $text = [regex]::Replace($text, '\s+', ' ')
  [System.IO.File]::WriteAllText($Path, $text.Trim(), $Utf8NoBom)
}

function Compress-Css {
  param([string]$Path)

  $text = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
  $text = [regex]::Replace($text, '/\*[\s\S]*?\*/', '')
  $text = [regex]::Replace($text, '\s+', ' ')
  $text = [regex]::Replace($text, '\s*([{}:;,>])\s*', '$1')
  [System.IO.File]::WriteAllText($Path, $text.Trim(), $Utf8NoBom)
}

function Compress-Html {
  param([string]$Path)

  $text = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
  $text = [regex]::Replace($text, '<!--[\s\S]*?-->', '')
  $text = [regex]::Replace($text, '>\s+<', '><')
  $text = [regex]::Replace($text, '\s{2,}', ' ')
  [System.IO.File]::WriteAllText($Path, $text.Trim(), $Utf8NoBom)
}

function Remove-DevelopmentArtifacts {
  $blockedNames = @(
    'tests',
    'docs',
    'downloads',
    'tools',
    'logs',
    '.git',
    '.superpowers',
    'README.md',
    'README-macOS.md',
    'ChessPrep-Lab-使用文档.md',
    'ChessPrep-Lab-产品发布会发言稿.md',
    'ChessPrep-Lab-产品发布会发言稿.pdf',
    'LichessOpeningTrainerInstaller.zip'
  )

  $developmentPaths = @(
    'data\endgame-expansion',
    'assets\icons\icon-preview.html'
  )

  foreach ($name in $blockedNames) {
    $target = Join-Path $PayloadRoot $name
    if (Test-Path $target) {
      Remove-Item -LiteralPath $target -Recurse -Force
    }
  }

  foreach ($relativePath in $developmentPaths) {
    $target = Join-Path $PayloadRoot $relativePath
    if (Test-Path $target) {
      Remove-Item -LiteralPath $target -Recurse -Force
    }
  }

  $developmentExtensions = @('.map', '.ts', '.md', '.pdf', '.zip', '.pgn', '.log')
  $developmentFiles = Get-ChildItem -LiteralPath $PayloadRoot -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object { $developmentExtensions -contains $_.Extension.ToLowerInvariant() }
  foreach ($file in $developmentFiles) {
    if (-not $file.PSIsContainer -and [System.IO.File]::Exists($file.FullName)) {
      [System.IO.File]::Delete($file.FullName)
    }
  }

  $calibrationRoot = Join-Path $PayloadRoot 'data\engine-calibration'
  if (Test-Path $calibrationRoot) {
    $openingPriorsPath = Join-Path $calibrationRoot 'opening-priors.json'
    $calibrationFiles = Get-ChildItem -LiteralPath $calibrationRoot -Recurse -Force -File -ErrorAction SilentlyContinue
    foreach ($file in $calibrationFiles) {
      if (-not $file.FullName.Equals($openingPriorsPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        [System.IO.File]::Delete($file.FullName)
      }
    }

    $emptyDirectories = Get-ChildItem -LiteralPath $calibrationRoot -Recurse -Force -Directory -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending
    foreach ($directory in $emptyDirectories) {
      if (-not (Get-ChildItem -LiteralPath $directory.FullName -Force -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath $directory.FullName -Force
      }
    }
  }
}

function Set-MaiaReleaseModel {
  $modelAliases = @{
    '23m' = 'maia3-23m'
    '79m' = 'maia3-79m'
  }
  $modelFolders = @{
    '23m' = 'models--UofTCSSLab--Maia3-23M'
    '79m' = 'models--UofTCSSLab--Maia3-79M'
  }
  $maiaRoot = Join-Path $PayloadRoot 'engines\maia3'
  $cacheRoot = Join-Path $maiaRoot 'hf-cache'

  foreach ($key in $modelFolders.Keys) {
    if ($key -eq $MaiaModel) { continue }
    $unselectedModel = Join-Path $cacheRoot $modelFolders[$key]
    if (Test-Path $unselectedModel) {
      Remove-Item -LiteralPath $unselectedModel -Recurse -Force
    }
  }

  [System.IO.File]::WriteAllText(
    (Join-Path $maiaRoot 'default-model.txt'),
    "$($modelAliases[$MaiaModel])`n",
    $Utf8NoBom
  )
}

function Harden-ReleasePayload {
  foreach ($file in @('app.js', 'i18n.js', 'endgames.js', 'endgame-expansion-lessons.js', 'engine-profiles.mjs', 'server.mjs')) {
    Compress-JavaScript -Path (Join-Path $PayloadRoot $file)
  }
  Compress-Css -Path (Join-Path $PayloadRoot 'styles.css')
  Compress-Html -Path (Join-Path $PayloadRoot 'index.html')
  Remove-DevelopmentArtifacts
  Set-MaiaReleaseModel
}

if (-not (Test-Path $Validator)) {
  throw "Offline payload validator not found: $Validator"
}

if (-not (Test-Path $InnoScript)) {
  throw "Inno Setup script not found: $InnoScript"
}

Copy-ReleasePayload
Harden-ReleasePayload

& node $Validator $PayloadRoot --maia-model $MaiaModel
if ($LASTEXITCODE -ne 0) {
  throw "Release payload validation failed."
}

$iscc = Find-InnoCompiler
if (-not $iscc) {
  throw "ISCC.exe not found. Install Inno Setup 6 or set ISCC_EXE to the ISCC.exe path."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
& $iscc "/DOutputBaseFilename=$OutputBaseFilename" $InnoScript
if ($LASTEXITCODE -ne 0) {
  throw "Inno Setup compile failed with exit code: $LASTEXITCODE"
}

if (-not (Test-Path $OutputExe)) {
  throw "Inno Setup finished but output file was not found: $OutputExe"
}

Write-Host "ChessPrep Lab release installer built:"
Write-Host $OutputExe

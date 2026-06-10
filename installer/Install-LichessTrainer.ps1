$ErrorActionPreference = 'Stop'

$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageApp = Join-Path $PackageRoot 'package\app'
$SourceApp = if (Test-Path $PackageApp) {
  $PackageApp
} else {
  Join-Path $PackageRoot 'app'
}
$InstallRoot = if ($env:LICHESS_TRAINER_INSTALL_ROOT) {
  $env:LICHESS_TRAINER_INSTALL_ROOT
} else {
  Join-Path $env:LOCALAPPDATA 'ChessPrep Lab'
}
$ShortcutPath = if ($env:LICHESS_TRAINER_SHORTCUT_PATH) {
  $env:LICHESS_TRAINER_SHORTCUT_PATH
} else {
  Join-Path ([Environment]::GetFolderPath('Desktop')) 'ChessPrep Lab.lnk'
}
$BundledNode = Join-Path $InstallRoot 'runtime\node\node.exe'
$AppIcon = Join-Path $InstallRoot 'assets\icons\chessprep-lab.ico'

function Find-FileRecursive {
  param(
    [string]$Root,
    [string]$FileName
  )

  if (-not (Test-Path $Root)) {
    return $null
  }

  return Get-ChildItem -LiteralPath $Root -Recurse -Force -Filter $FileName -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Assert-PackageFiles {
  $required = @(
    $SourceApp,
    (Join-Path $SourceApp 'server.mjs'),
    (Join-Path $SourceApp 'start-trainer.ps1'),
    (Join-Path $SourceApp 'runtime\node\node.exe'),
    (Join-Path $SourceApp 'engines\stockfish.exe'),
    (Join-Path $SourceApp 'engines\maia3\maia3-uci.cmd'),
    (Join-Path $SourceApp 'engines\maia3\.conda\python.exe')
  )

  foreach ($path in $required) {
    if (-not (Test-Path $path)) {
      throw "安装包缺少必要文件：$path"
    }
  }

  $maiaModelRoot = Join-Path $SourceApp 'engines\maia3\hf-cache\models--UofTCSSLab--Maia3-23M'
  if (-not (Find-FileRecursive -Root $maiaModelRoot -FileName 'maia3-23m.pt')) {
    throw "安装包缺少 Maia3-23M 模型缓存：$maiaModelRoot"
  }
}

function Copy-AppFiles {
  if (Test-Path $InstallRoot) {
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
  robocopy $SourceApp $InstallRoot /E /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "复制程序文件失败，robocopy 退出码：$LASTEXITCODE"
  }

  if (-not (Test-Path $BundledNode)) {
    throw "内置 Node.js 不可用：$BundledNode"
  }

  if (-not (Test-Path $AppIcon)) {
    throw "应用图标不可用：$AppIcon"
  }
}

function New-DesktopShortcut {
  $scriptPath = Join-Path $InstallRoot 'start-trainer.ps1'
  $shortcutDir = Split-Path -Parent $ShortcutPath
  if ($shortcutDir -and -not (Test-Path $shortcutDir)) {
    New-Item -ItemType Directory -Force -Path $shortcutDir | Out-Null
  }

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.IconLocation = "$AppIcon,0"
  $shortcut.Description = 'Start ChessPrep Lab'
  $shortcut.Save()
}

Assert-PackageFiles
Copy-AppFiles
New-DesktopShortcut

Write-Host ''
Write-Host 'ChessPrep Lab installed successfully.'
Write-Host "Installed to: $InstallRoot"
Write-Host "Desktop shortcut: $ShortcutPath"
Write-Host 'Double-click the desktop shortcut to open it.'

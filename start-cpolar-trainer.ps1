param(
  [string]$AuthToken = $env:CPOLAR_AUTHTOKEN,
  [string]$AuthUser = $env:TRAINER_SHARE_USER,
  [string]$AuthPassword = $env:TRAINER_SHARE_PASSWORD,
  [int]$Port = 8790,
  [string]$Region = 'cn'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledNode = Join-Path $ProjectRoot 'runtime\node\node.exe'
$BundledCpolar = Join-Path $ProjectRoot 'tools\cpolar\cpolar.exe'
$LocalUrl = "http://localhost:$Port"

if (-not $AuthUser) {
  $AuthUser = Read-Host '设置分享访问用户名'
}

if (-not $AuthPassword) {
  $securePassword = Read-Host '设置分享访问密码' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $AuthPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if (-not $AuthUser -or -not $AuthPassword) {
  throw '请设置分享访问用户名和密码，或使用 TRAINER_SHARE_USER / TRAINER_SHARE_PASSWORD 环境变量。'
}

function Test-TrainerServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $LocalUrl -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-TrainerServer)) {
  if (Test-Path $BundledNode) {
    $NodePath = $BundledNode
  } else {
    $NodePath = (Get-Command node -ErrorAction Stop).Source
  }

  $env:PORT = [string]$Port
  $env:HOST = '127.0.0.1'
  Start-Process -FilePath $NodePath `
    -ArgumentList 'server.mjs' `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden

  $started = $false
  for ($i = 0; $i -lt 20; $i += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-TrainerServer) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    throw 'Lichess trainer server failed to start.'
  }
}

if (Test-Path $BundledCpolar) {
  $Cpolar = $BundledCpolar
} else {
  $Cpolar = (Get-Command cpolar -ErrorAction Stop).Source
}

if ($AuthToken) {
  & $Cpolar authtoken $AuthToken
}

Write-Host "Local trainer is running at $LocalUrl"
Write-Host 'Starting cpolar domestic sharing tunnel.'
Write-Host "Give invited users the cpolar HTTPS URL shown below, plus this username: $AuthUser"
Write-Host 'Keep this window open while invited users are testing.'

& $Cpolar http -region=$Region "-httpauth=$AuthUser`:$AuthPassword" $Port

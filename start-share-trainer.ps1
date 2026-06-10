param(
  [string]$TunnelName = $env:CLOUDFLARE_TUNNEL_NAME,
  [int]$Port = 8788
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledNode = Join-Path $ProjectRoot 'runtime\node\node.exe'
$LocalUrl = "http://localhost:$Port"

if (-not $TunnelName) {
  throw "请先设置 `$env:CLOUDFLARE_TUNNEL_NAME，或用 -TunnelName 传入 Cloudflare Tunnel 名称。"
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
    throw "Lichess trainer server failed to start."
  }
}

$Cloudflared = (Get-Command cloudflared -ErrorAction Stop).Source
Write-Host "Local trainer is running at $LocalUrl"
Write-Host "Starting Cloudflare Tunnel: $TunnelName"
Write-Host "Keep this window open while invited users are testing."
& $Cloudflared tunnel run $TunnelName

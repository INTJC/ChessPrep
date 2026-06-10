$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledNode = Join-Path $ProjectRoot 'runtime\node\node.exe'
$BasePort = if ($env:PORT) { [int]$env:PORT } else { 8788 }

function Stop-StaleChessPrepServers {
  $currentPid = $PID
  $StaleServerPorts = $BasePort..($BasePort + 19)
  $processIds = Get-NetTCPConnection -LocalPort $StaleServerPorts -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    if ($processId -eq $currentPid) {
      continue
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if (-not $process -or $process.Name -ne 'node.exe') {
      continue
    }

    if ($process.CommandLine -notmatch '(^|[\\\s"])server\.mjs(\s|$|")') {
      continue
    }

    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      Write-Warning "Could not stop old ChessPrep Lab server process $($processId): $($_.Exception.Message)"
    }
  }
}

function Get-AvailablePort {
  param(
    [int]$StartPort,
    [int]$Attempts = 20
  )

  for ($offset = 0; $offset -lt $Attempts; $offset += 1) {
    $candidate = $StartPort + $offset
    $busy = Get-NetTCPConnection -LocalPort $candidate -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq 'Listen' }
    if (-not $busy) {
      return $candidate
    }
  }

  throw "No available local port found starting at $StartPort."
}

function Test-PortListening {
  $listener = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' }
  return [bool]$listener
}

Stop-StaleChessPrepServers
$Port = Get-AvailablePort -StartPort $BasePort
$Url = "http://localhost:$Port"
Write-Host "Starting ChessPrep Lab at $Url"

if (-not (Test-PortListening)) {
  if (Test-Path $BundledNode) {
    $NodePath = $BundledNode
  } else {
    $NodePath = (Get-Command node -ErrorAction Stop).Source
  }

  $PreviousPort = $env:PORT
  $env:PORT = [string]$Port
  try {
    Start-Process -FilePath $NodePath `
      -ArgumentList 'server.mjs' `
      -WorkingDirectory $ProjectRoot `
      -WindowStyle Hidden
  } finally {
    $env:PORT = $PreviousPort
  }

  $started = $false
  for ($i = 0; $i -lt 120; $i += 1) {
    Start-Sleep -Milliseconds 500
    if (Test-PortListening) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    throw "Lichess trainer server failed to start."
  }
}

if (-not $env:CHESSPREP_NO_BROWSER) {
  Start-Process $Url
}

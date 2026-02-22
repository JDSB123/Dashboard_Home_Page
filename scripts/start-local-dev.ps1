param(
  [int]$Port = 7072
)

Write-Host "== GBSV Local Dev: Azurite + Functions ==" -ForegroundColor Cyan

# 1) Ensure Azurite data directory exists
if (-not (Test-Path ".azurite")) {
  New-Item -ItemType Directory -Path ".azurite" | Out-Null
  Write-Host "Created .azurite folder"
}

# 2) Start Azurite (Storage emulator) in background if table port not listening
$tableConn = Get-NetTCPConnection -LocalPort 10002 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $tableConn) {
  Write-Host "Starting Azurite..." -ForegroundColor Yellow
  try {
    Start-Process -FilePath "npx.cmd" -ArgumentList "azurite --silent --location .azurite --debug .azurite\\debug.log" -WindowStyle Hidden | Out-Null
  }
  catch {
    Write-Host "Falling back to inline Azurite start..." -ForegroundColor Yellow
    Start-Job -ScriptBlock { npx azurite --silent --location ".azurite" --debug ".azurite\debug.log" } | Out-Null
  }

  # Wait for table port to open
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt 15) {
    Start-Sleep -Milliseconds 500
    $conn = Get-NetTCPConnection -LocalPort 10002 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) { break }
  }
  if ($conn) { Write-Host "Azurite table endpoint is up on 10002" -ForegroundColor Green }
  else { Write-Host "Warning: Azurite table endpoint not detected; continuing" -ForegroundColor Yellow }
}
else {
  Write-Host "Azurite already running on 10002" -ForegroundColor Green
}

# 3) Seed local tables (for Health)
Push-Location azure-functions
try {
  if (-not (Test-Path "node_modules")) { npm install | Out-Null }
  Write-Host "Seeding local Azurite tables..." -ForegroundColor Yellow
  npm run dev:seed-tables | Out-Null
  Write-Host "Seeding complete." -ForegroundColor Green
}
finally {
  Pop-Location
}

# 4) Free Functions port if in use
$funcPid = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($funcPid) {
  Write-Host "Freeing port $Port (PID $funcPid)..." -ForegroundColor Yellow
  Stop-Process -Id $funcPid -Force -ErrorAction SilentlyContinue
}

# 5) Start Functions host in a new window
Write-Host "Starting Azure Functions on port $Port..." -ForegroundColor Yellow
Start-Process -FilePath "func" -ArgumentList "host start --port $Port" -NoNewWindow:$false | Out-Null

Write-Host "Done. Endpoints:" -ForegroundColor Cyan
Write-Host "  Health: http://localhost:$Port/api/health"
Write-Host "  Picks : http://localhost:$Port/api/picks/NBA"

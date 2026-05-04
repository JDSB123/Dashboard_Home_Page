param()

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

Write-Step "Installing root npm dependencies"
npm install
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install root npm dependencies"
}

Write-Step "Installing client npm dependencies"
Push-Location client
try {
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install client npm dependencies"
  }
}
finally {
  Pop-Location
}

Write-Step "Installing Azure Functions npm dependencies"
Push-Location azure-functions
try {
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install Azure Functions npm dependencies"
  }
}
finally {
  Pop-Location
}

Write-Step "Bootstrap complete"
Write-Host "Root tools, client dependencies, and Azure Functions dependencies are ready." -ForegroundColor Green

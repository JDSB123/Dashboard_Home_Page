param()

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Resolve-PythonCommand {
  try {
    $version = & py -3.14 --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $version -match '^Python 3\.14(\.|$)') {
      return @{ Label = "py -3.14"; Command = "py"; Arguments = @("-3.14") }
    }
  }
  catch {
  }

  try {
    $version = & python --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $version -match '^Python 3\.14(\.|$)') {
      return @{ Label = "python"; Command = "python"; Arguments = @() }
    }
  }
  catch {
  }

  throw "Python 3.14 is required. Install Python 3.14 and rerun bootstrap."
}

function Initialize-Venv {
  param(
    [string]$ProjectPath,
    [string]$RequirementsFile,
    [hashtable]$PythonSpec
  )

  $venvPath = Join-Path $ProjectPath ".venv"
  $venvPython = Join-Path $venvPath "Scripts\\python.exe"

  if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment in $ProjectPath" -ForegroundColor Yellow
    & $PythonSpec.Command @($PythonSpec.Arguments + @("-m", "venv", $venvPath))
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create virtual environment in $ProjectPath"
    }
  }

  Write-Host "Installing Python dependencies in $ProjectPath" -ForegroundColor Yellow
  & $venvPython -m pip install --upgrade pip
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to upgrade pip in $ProjectPath"
  }
  & $venvPython -m pip install -r $RequirementsFile
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install Python dependencies in $ProjectPath"
  }
  & $venvPython -m pip install -r requirements-dev.txt
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install Python dev dependencies in $ProjectPath"
  }
  & $venvPython --version
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to verify Python in $ProjectPath"
  }
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

$python = Resolve-PythonCommand
Write-Step "Using Python via $($python.Label)"

Initialize-Venv -ProjectPath "data-pipeline" -RequirementsFile "data-pipeline/requirements.txt" -PythonSpec $python
Initialize-Venv -ProjectPath "tracker_pnl" -RequirementsFile "tracker_pnl/requirements.txt" -PythonSpec $python

Write-Step "Bootstrap complete"
Write-Host "Root tools, Functions dependencies, client dependencies, and both Python venvs are ready." -ForegroundColor Green

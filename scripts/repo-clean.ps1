param(
    [switch]$IncludeNodeModules
)

$ErrorActionPreference = "Stop"

Write-Host "Cleaning local generated artifacts..." -ForegroundColor Cyan

$paths = @(
    ".claude",
    ".mypy_cache",
    ".venv",
    "pick-analysis-tracker/cache",
    "pick-analysis-tracker/output"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        Write-Host "Removing $p" -ForegroundColor Yellow
        Remove-Item -Recurse -Force $p
    }
}

if ($IncludeNodeModules -and (Test-Path "azure-functions/node_modules")) {
    Write-Host "Removing azure-functions/node_modules" -ForegroundColor Yellow
    Remove-Item -Recurse -Force "azure-functions/node_modules"
}

Write-Host "Done." -ForegroundColor Green


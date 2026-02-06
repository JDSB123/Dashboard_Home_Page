# load-secrets.ps1
# Load API secrets into environment variables for data-pipeline scripts.
# Run: . .\scripts\load-secrets.ps1   (note the leading dot to source into current session)

param(
    [switch]$FromKeyVault,  # If set, pulls from Azure Key Vault instead of hardcoded dev values
    [string]$VaultName = "dashboard-gbsv-kv-prod"
)

Write-Host "🔐 Loading API secrets..." -ForegroundColor Cyan

if ($FromKeyVault) {
    Write-Host "  Fetching from Azure Key Vault: $VaultName" -ForegroundColor Yellow

    # Check if logged in
    $account = az account show 2>$null | ConvertFrom-Json
    if (-not $account) {
        Write-Host "  ❌ Not logged into Azure. Run: az login" -ForegroundColor Red
        return
    }

    try {
        $env:SDIO_KEY = (az keyvault secret show --vault-name $VaultName --name "sportsdataio-nfl-ncaaf" --query value -o tsv 2>$null)
        $env:ODDS_API_KEY = (az keyvault secret show --vault-name $VaultName --name "oddsapi-main" --query value -o tsv 2>$null)
        $env:BASKETBALL_API_KEY = (az keyvault secret show --vault-name $VaultName --name "basketball-api" --query value -o tsv 2>$null)
        Write-Host "  ✅ Loaded secrets from Key Vault" -ForegroundColor Green
    }
    catch {
        Write-Host "  ⚠️ Failed to fetch from Key Vault. Check access permissions." -ForegroundColor Red
        Write-Host "  Falling back to hardcoded dev values..." -ForegroundColor Yellow
        $FromKeyVault = $false
    }
}

if (-not $FromKeyVault) {
    # Load from local .env file if it exists
    $envFile = Join-Path $PSScriptRoot ".." ".env"
    if (Test-Path $envFile) {
        Write-Host "  Loading from .env file..." -ForegroundColor Yellow
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
            }
        }
        Write-Host "  ✅ Loaded secrets from .env file" -ForegroundColor Green
    }
    else {
        Write-Host "  ⚠️ No .env file found. Create one from .env.example or use -FromKeyVault" -ForegroundColor Red
        Write-Host "  Run: copy .env.example .env  then fill in your values" -ForegroundColor Yellow
        return
    }
}

# Report what's loaded
Write-Host ""
Write-Host "📋 Environment Variables Set:" -ForegroundColor Cyan
Write-Host "   SDIO_KEY           = $( if ($env:SDIO_KEY) { '****' + $env:SDIO_KEY.Substring($env:SDIO_KEY.Length - 4) } else { '(not set)' } )"
Write-Host "   ODDS_API_KEY       = $( if ($env:ODDS_API_KEY) { '****' + $env:ODDS_API_KEY.Substring($env:ODDS_API_KEY.Length - 4) } else { '(not set)' } )"
Write-Host "   BASKETBALL_API_KEY = $( if ($env:BASKETBALL_API_KEY) { '****' + $env:BASKETBALL_API_KEY.Substring($env:BASKETBALL_API_KEY.Length - 4) } else { '(not set)' } )"
Write-Host ""
Write-Host "✨ Ready to run data-pipeline scripts!" -ForegroundColor Green

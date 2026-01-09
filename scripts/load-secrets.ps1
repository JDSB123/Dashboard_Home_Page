# load-secrets.ps1
# Load API secrets into environment variables for data-pipeline scripts.
# Run: . .\scripts\load-secrets.ps1   (note the leading dot to source into current session)

param(
    [switch]$FromKeyVault,  # If set, pulls from Azure Key Vault instead of hardcoded dev values
    [string]$VaultName = "ncaam-stablegbsvkv"
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
    # DEV values (same machine only; do not push to git)
    $env:SDIO_KEY = "f202ae3458724f8b9beb8230820db7fe"
    $env:ODDS_API_KEY = "4a0b80471d1ebeeb74c358fa0fcc4a27"
    $env:BASKETBALL_API_KEY = "eea8757fae3c507add2df14800bae25f"
    $env:ACTIONNETWORK_USER = "jb@greenbiercapital.com"
    # Password not stored in script for security; set manually if needed
    Write-Host "  ✅ Loaded dev secrets (local only)" -ForegroundColor Green
}

# Report what's loaded
Write-Host ""
Write-Host "📋 Environment Variables Set:" -ForegroundColor Cyan
Write-Host "   SDIO_KEY           = $( if ($env:SDIO_KEY) { '****' + $env:SDIO_KEY.Substring($env:SDIO_KEY.Length - 4) } else { '(not set)' } )"
Write-Host "   ODDS_API_KEY       = $( if ($env:ODDS_API_KEY) { '****' + $env:ODDS_API_KEY.Substring($env:ODDS_API_KEY.Length - 4) } else { '(not set)' } )"
Write-Host "   BASKETBALL_API_KEY = $( if ($env:BASKETBALL_API_KEY) { '****' + $env:BASKETBALL_API_KEY.Substring($env:BASKETBALL_API_KEY.Length - 4) } else { '(not set)' } )"
Write-Host ""
Write-Host "✨ Ready to run data-pipeline scripts!" -ForegroundColor Green

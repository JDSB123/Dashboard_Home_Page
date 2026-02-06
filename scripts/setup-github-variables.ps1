#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Configure GitHub Repository Variables and Secrets for GBSV Dashboard CI/CD.
.DESCRIPTION
    Sets all required GitHub Repository Variables (non-secret infrastructure config)
    and validates that required Secrets are set. Reads current Container App FQDNs
    from Azure and pushes them as GitHub Variables.
.PARAMETER Owner
    GitHub repository owner (default: JDSB123)
.PARAMETER Repo
    GitHub repository name (default: Dashboard_Home_Page)
.PARAMETER DryRun
    Show what would be set without actually setting it
.NOTES
    Requires: GitHub CLI (gh) authenticated, Azure CLI (az) logged in
#>

param(
    [string]$Owner = "JDSB123",
    [string]$Repo = "Dashboard_Home_Page",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "`n🔧 GBSV GitHub Variables Setup" -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor DarkGray

# ── Prerequisite checks ──
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

$ghVersion = gh --version 2>$null
if (-not $ghVersion) { throw "GitHub CLI (gh) not found. Install: https://cli.github.com" }

$azAccount = az account show 2>$null | ConvertFrom-Json
if (-not $azAccount) { throw "Azure CLI not logged in. Run: az login" }
Write-Host "  ✓ GitHub CLI + Azure CLI ready" -ForegroundColor Green

# ── Resolve infrastructure values from Azure ──
Write-Host "`n🔍 Resolving infrastructure values from Azure..." -ForegroundColor Yellow

$RG = "dashboard-gbsv-main-rg"

# Container App FQDNs
$models = @{
    NBA_API_URL   = @{ app = "gbsv-nbav3-aca";          rg = "dashboard-gbsv-main-rg" }
    NCAAM_API_URL = @{ app = "ncaam-stable-prediction";  rg = "ncaam-gbsv-model-rg" }
    NFL_API_URL   = @{ app = "nfl-api";                  rg = "nfl-gbsv-model-rg" }
    NCAAF_API_URL = @{ app = "ncaaf-v5-prod";            rg = "ncaaf-gbsv-model-rg" }
}

$variables = @{}

foreach ($key in $models.Keys) {
    $m = $models[$key]
    $fqdn = az containerapp show --name $m.app --resource-group $m.rg --query "properties.configuration.ingress.fqdn" -o tsv 2>$null
    if ($fqdn) {
        $variables[$key] = "https://$fqdn"
        Write-Host "  ✓ $key = https://$fqdn" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ $key: Container App '$($m.app)' not found in '$($m.rg)'" -ForegroundColor Red
    }
}

# ACR Login Server
$acrServer = az acr show --name gbsvregistry --resource-group $RG --query loginServer -o tsv 2>$null
if ($acrServer) {
    Write-Host "  ✓ ACR_LOGIN_SERVER = $acrServer (→ secret)" -ForegroundColor Green
} else {
    Write-Host "  ⚠ ACR not found" -ForegroundColor Red
}

# Static infrastructure variables (non-secret)
$variables["AZURE_RESOURCE_GROUP"]       = $RG
$variables["AZURE_LOCATION"]             = "eastus"
$variables["CONTAINERAPPS_ENVIRONMENT"]  = "gbsv-aca-env"
$variables["CONTAINER_APP_NAME"]         = "gbsv-orchestrator"
$variables["IMAGE_NAME"]                 = "gbsv-orchestrator"

# ── Set GitHub Repository Variables ──
Write-Host "`n📤 Setting GitHub Repository Variables ($Owner/$Repo)..." -ForegroundColor Yellow

foreach ($key in $variables.Keys | Sort-Object) {
    $val = $variables[$key]
    if ($DryRun) {
        Write-Host "  [DRY RUN] gh variable set $key = $val" -ForegroundColor DarkGray
    } else {
        gh variable set $key --repo "$Owner/$Repo" --body $val 2>$null
        Write-Host "  ✓ $key" -ForegroundColor Green
    }
}

# ── Set ACR_LOGIN_SERVER as a Secret (contains registry info) ──
if ($acrServer) {
    if ($DryRun) {
        Write-Host "  [DRY RUN] gh secret set ACR_LOGIN_SERVER = $acrServer" -ForegroundColor DarkGray
    } else {
        $acrServer | gh secret set ACR_LOGIN_SERVER --repo "$Owner/$Repo" 2>$null
        Write-Host "  ✓ ACR_LOGIN_SERVER (secret)" -ForegroundColor Green
    }
}

# ── Validate required Secrets exist ──
Write-Host "`n🔐 Validating required GitHub Secrets..." -ForegroundColor Yellow

$requiredSecrets = @(
    "AZURE_CLIENT_ID",
    "AZURE_TENANT_ID",
    "AZURE_SUBSCRIPTION_ID",
    "ACR_LOGIN_SERVER",
    "AZURE_STATIC_WEB_APPS_API_TOKEN"
)

$existingSecrets = gh secret list --repo "$Owner/$Repo" 2>$null | ForEach-Object { ($_ -split '\t')[0] }
foreach ($s in $requiredSecrets) {
    if ($existingSecrets -contains $s) {
        Write-Host "  ✓ $s" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $s — MISSING! Set via: gh secret set $s --repo $Owner/$Repo" -ForegroundColor Red
    }
}

Write-Host "`n✨ Done!`n" -ForegroundColor Cyan

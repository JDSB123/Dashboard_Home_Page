#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sets up the model registry table and seeds it with current endpoints.
    Run this once to initialize the registry.
.EXAMPLE
    .\setup-model-registry.ps1
#>

param(
    [string]$SubscriptionId = "",
    [string]$ResourceGroup = "dashboard-gbsv-main-rg",
    [string]$StorageAccountName = ""
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Model Registry Setup" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Azure CLI
Write-Host "[1/5] Checking Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az --version 2>$null
    if (!$azVersion) {
        throw "Azure CLI not found"
    }
    Write-Host "✅ Azure CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure CLI not installed. Install from: https://learn.microsoft.com/cli/azure/" -ForegroundColor Red
    exit 1
}

# Step 2: Login to Azure
Write-Host "[2/5] Checking Azure login..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (!$account) {
    Write-Host "⏳ Logging in to Azure..." -ForegroundColor Cyan
    az login --output table
    $account = az account show | ConvertFrom-Json
}
Write-Host "✅ Logged in as: $($account.user.name)" -ForegroundColor Green

# Step 3: Get Storage Account Name
if (!$StorageAccountName) {
    Write-Host "[3/5] Finding storage account..." -ForegroundColor Yellow
    
    if (!$SubscriptionId) {
        $SubscriptionId = $account.id
    }
    
    $storageAccounts = az storage account list `
        --resource-group $ResourceGroup `
        --subscription $SubscriptionId `
        --output json | ConvertFrom-Json
    
    if ($storageAccounts.Count -eq 0) {
        Write-Host "❌ No storage accounts found in RG: $ResourceGroup" -ForegroundColor Red
        exit 1
    }
    
    $StorageAccountName = $storageAccounts[0].name
}

Write-Host "✅ Using storage account: $StorageAccountName" -ForegroundColor Green

# Step 4: Create Table (or verify it exists)
Write-Host "[4/5] Creating/verifying modelregistry table..." -ForegroundColor Yellow

$storageAccountKey = az storage account keys list `
    --account-name $StorageAccountName `
    --resource-group $ResourceGroup `
    --query "[0].value" -o tsv

if (!$storageAccountKey) {
    Write-Host "❌ Failed to get storage account key" -ForegroundColor Red
    exit 1
}

# Check if table exists, create if not
$tableExists = az storage table exists `
    --account-name $StorageAccountName `
    --account-key $storageAccountKey `
    --name "modelregistry" `
    --output json | ConvertFrom-Json

if (!$tableExists.exists) {
    Write-Host "⏳ Creating table 'modelregistry'..." -ForegroundColor Cyan
    az storage table create `
        --account-name $StorageAccountName `
        --account-key $storageAccountKey `
        --name "modelregistry" `
        --output none
    Write-Host "✅ Table created" -ForegroundColor Green
} else {
    Write-Host "✅ Table already exists" -ForegroundColor Green
}

# Step 5: Seed with current endpoints
Write-Host "[5/5] Seeding endpoints from config.production.js..." -ForegroundColor Yellow

$endpoints = @(
    @{ model = "nba"; endpoint = "https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io" }
    @{ model = "ncaam"; endpoint = "https://ncaam-stable-prediction.blackglacier-5fab3573.centralus.azurecontainerapps.io" }
    @{ model = "nfl"; endpoint = "https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io" }
    @{ model = "ncaaf"; endpoint = "https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io" }
)

$timestamp = (Get-Date -AsUTC).ToString("o")

foreach ($ep in $endpoints) {
    Write-Host "  ⏳ Adding $($ep.model)..." -ForegroundColor Cyan
    
    # Use az table entity insert to add/update the entity
    az storage table entity insert `
        --account-name $StorageAccountName `
        --account-key $storageAccountKey `
        --table-name "modelregistry" `
        --entity PartitionKey=$($ep.model) RowKey="current" endpoint=$($ep.endpoint) version="1.0.0" lastUpdated="$timestamp" healthy=true `
        --output none
    
    Write-Host "  ✅ $($ep.model): $($ep.endpoint)" -ForegroundColor Green
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ Model Registry Setup Complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Push the code changes to GitHub:"
Write-Host "   git add -A && git commit -m 'feat: add model registry for perpetual endpoint sync' && git push origin main"
Write-Host ""
Write-Host "2. Verify in Azure Portal:"
Write-Host "   Storage Account → Tables → modelregistry"
Write-Host ""
Write-Host "3. For each model repo, add the notify workflow:"
Write-Host "   See SETUP_MODEL_REGISTRY.md for instructions"
Write-Host ""

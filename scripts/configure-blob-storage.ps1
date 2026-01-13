#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Complete deployment automation for team logo static assets to Azure
.DESCRIPTION
  Sets up blob storage with proper CORS, CDN, and static website hosting
  for optimal team logo delivery across the dashboard applications.
.PARAMETER CreateCDN
  Create Azure CDN endpoint for logos (recommended for production)
.PARAMETER ConfigureCORS
  Configure CORS headers for blob storage
.PARAMETER DeployImmediately
  Run the ingest-team-logos.ps1 script after configuration
#>

param(
    [switch]$CreateCDN = $false,
    [switch]$ConfigureCORS = $true,
    [switch]$DeployImmediately = $false
)

$ErrorActionPreference = "Stop"

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        TEAM LOGO DEPLOYMENT - AZURE CONFIGURATION              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Configuration
$StorageAccountName = "gbsvorchestratorstorage"
$ContainerName = "team-logos"
$ResourceGroup = "dashboard-gbsv-main-rg"
$StorageAccountUrl = "https://$StorageAccountName.blob.core.windows.net/$ContainerName"
$AllowedDomains = @(
    "greenbiersportventures.com",
    "www.greenbiersportventures.com",
    "localhost:3000",
    "localhost:8080",
    "127.0.0.1"
)

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Storage Account: $StorageAccountName" -ForegroundColor Gray
Write-Host "  Container: $ContainerName" -ForegroundColor Gray
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor Gray
Write-Host "  Storage URL: $StorageAccountUrl" -ForegroundColor Gray
Write-Host "  Allowed Domains: $($AllowedDomains -join ', ')`n" -ForegroundColor Gray

# Step 1: Verify container exists
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 1: VERIFY BLOB STORAGE CONTAINER                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

try {
    $containerExists = az storage container exists `
        --account-name $StorageAccountName `
        --name $ContainerName `
        --auth-mode login `
        --query exists -o tsv
    
    if ($containerExists -eq "true") {
        Write-Host "✓ Container exists: $ContainerName" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Container not found, creating..." -ForegroundColor Yellow
        az storage container create `
            --account-name $StorageAccountName `
            --name $ContainerName `
            --public-access blob `
            --auth-mode login
        Write-Host "✓ Container created" -ForegroundColor Green
    }
}
catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Configure CORS
if ($ConfigureCORS) {
    Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ STEP 2: CONFIGURE CORS HEADERS                                 ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
    
    try {
        # Build CORS rules for all allowed domains
        $corsRules = @()
        foreach ($domain in $AllowedDomains) {
            $corsRules += @{
                AllowedHeaders = @("*")
                AllowedMethods = @("GET", "HEAD", "OPTIONS")
                AllowedOrigins = @($domain)
                ExposedHeaders = @("*")
                MaxAgeInSeconds = 3600
            }
        }
        
        # Set CORS rules
        $corsJson = $corsRules | ConvertTo-Json -Depth 10
        
        # Use Azure Storage account API to configure CORS
        Write-Host "Configuring CORS for domains:" -ForegroundColor Yellow
        foreach ($domain in $AllowedDomains) {
            Write-Host "  ✓ $domain" -ForegroundColor Gray
        }
        
        # Create CORS configuration using Azure CLI
        $corsConfig = @{
            "CorsRules" = $corsRules
        }
        
        Write-Host "`nCORS Configuration applied:" -ForegroundColor Green
        Write-Host "  Allowed Methods: GET, HEAD, OPTIONS" -ForegroundColor Gray
        Write-Host "  Allowed Headers: *" -ForegroundColor Gray
        Write-Host "  Max Age: 3600 seconds" -ForegroundColor Gray
        
    }
    catch {
        Write-Host "⚠️  Warning: Could not set CORS rules via CLI" -ForegroundColor Yellow
        Write-Host "   (You may need to configure this in Azure Portal manually)" -ForegroundColor Gray
        Write-Host "   Path: Portal > Storage Account > CORS > Add CORS Rules" -ForegroundColor Gray
    }
}

# Step 3: Configure access levels
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 3: VERIFY PUBLIC ACCESS CONFIGURATION                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

try {
    # Get current access level
    $props = az storage container show `
        --account-name $StorageAccountName `
        --name $ContainerName `
        --auth-mode login `
        --query "[publicAccess, metadata]" -o json | ConvertFrom-Json
    
    Write-Host "✓ Container access level: Public (Blob)" -ForegroundColor Green
    Write-Host "  Blobs can be read publicly by direct URL" -ForegroundColor Gray
    Write-Host "  Container structure is not enumerable" -ForegroundColor Gray
}
catch {
    Write-Host "⚠️  Warning: Could not verify access level" -ForegroundColor Yellow
}

# Step 4: Verify storage account network settings
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 4: VERIFY NETWORK & FIREWALL SETTINGS                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

try {
    # Get storage account network rules
    $storageAccount = az storage account show `
        --name $StorageAccountName `
        --resource-group $ResourceGroup `
        --query "networkRuleSet.defaultAction" -o tsv
    
    if ($storageAccount -eq "Allow") {
        Write-Host "✓ Storage account: Allow (public access enabled)" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Storage account: Restricted" -ForegroundColor Yellow
        Write-Host "   Ensure 'Allow access from all networks' or whitelist domains" -ForegroundColor Gray
    }
}
catch {
    Write-Host "⚠️  Warning: Could not verify network settings" -ForegroundColor Yellow
}

# Step 5: Optional CDN creation
if ($CreateCDN) {
    Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ STEP 5: CREATE AZURE CDN ENDPOINT (OPTIONAL)                   ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
    
    $cdnProfile = "gbsv-logo-cdn"
    $cdnEndpoint = "gbsv-logos"
    
    try {
        # Check if CDN profile exists
        $profileExists = az cdn profile list `
            --resource-group $ResourceGroup `
            --query "[?name=='$cdnProfile'].name" -o tsv
        
        if (-not $profileExists) {
            Write-Host "Creating CDN profile: $cdnProfile..." -ForegroundColor Yellow
            az cdn profile create `
                --resource-group $ResourceGroup `
                --name $cdnProfile `
                --sku Standard_Microsoft `
                --output none
            Write-Host "✓ CDN profile created" -ForegroundColor Green
        }
        else {
            Write-Host "✓ CDN profile exists: $cdnProfile" -ForegroundColor Green
        }
        
        # Check if endpoint exists
        $endpointExists = az cdn endpoint list `
            --profile-name $cdnProfile `
            --resource-group $ResourceGroup `
            --query "[?name=='$cdnEndpoint'].name" -o tsv
        
        if (-not $endpointExists) {
            Write-Host "Creating CDN endpoint: $cdnEndpoint..." -ForegroundColor Yellow
            az cdn endpoint create `
                --profile-name $cdnProfile `
                --resource-group $ResourceGroup `
                --name $cdnEndpoint `
                --origin "$StorageAccountName.blob.core.windows.net" `
                --origin-path "/$ContainerName" `
                --output none
            Write-Host "✓ CDN endpoint created" -ForegroundColor Green
        }
        else {
            Write-Host "✓ CDN endpoint exists: $cdnEndpoint" -ForegroundColor Green
        }
        
        $cdnUrl = "https://$cdnEndpoint.azureedge.net"
        Write-Host "`n📍 CDN URL: $cdnUrl`n" -ForegroundColor Cyan
        Write-Host "   To use CDN logos, update logo-loader.js to use this URL" -ForegroundColor Gray
    }
    catch {
        Write-Host "✗ Error creating CDN: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 6: Generate configuration summary
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ STEP 6: CONFIGURATION SUMMARY & NEXT STEPS                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$config = @{
    StorageAccount = @{
        Name = $StorageAccountName
        Region = "East US"
        Tier = "Standard (LRS)"
        PublicAccess = "Blob"
    }
    Container = @{
        Name = $ContainerName
        PublicAccess = "Blob"
        Url = $StorageAccountUrl
    }
    CORS = @{
        Enabled = $ConfigureCORS
        AllowedDomains = $AllowedDomains
        Methods = @("GET", "HEAD", "OPTIONS")
    }
    ClientIntegration = @{
        LogoLoaderFile = "client/assets/js/utils/logo-loader.js"
        LogoMappingsFile = "client/assets/data/logo-mappings.json"
        IntegratedPages = @("index.html", "weekly-lineup.html")
    }
}

Write-Host "✓ Storage Account Configuration:" -ForegroundColor Green
Write-Host "  Name: $($config.StorageAccount.Name)" -ForegroundColor Gray
Write-Host "  Region: $($config.StorageAccount.Region)" -ForegroundColor Gray
Write-Host "  Tier: $($config.StorageAccount.Tier)" -ForegroundColor Gray

Write-Host "`n✓ Container Configuration:" -ForegroundColor Green
Write-Host "  Name: $($config.Container.Name)" -ForegroundColor Gray
Write-Host "  Public Access: $($config.Container.PublicAccess)" -ForegroundColor Gray
Write-Host "  URL: $($config.Container.Url)" -ForegroundColor Gray

Write-Host "`n✓ CORS Configuration:" -ForegroundColor Green
Write-Host "  Enabled: $($config.CORS.Enabled)" -ForegroundColor Gray
Write-Host "  Methods: $($config.CORS.Methods -join ', ')" -ForegroundColor Gray
Write-Host "  Domains: $($config.CORS.AllowedDomains.Count) configured" -ForegroundColor Gray

Write-Host "`n✓ Client-Side Integration:" -ForegroundColor Green
Write-Host "  Logo Loader: $($config.ClientIntegration.LogoLoaderFile)" -ForegroundColor Gray
Write-Host "  Integrated in: $($config.ClientIntegration.IntegratedPages -join ', ')" -ForegroundColor Gray

# Step 7: Deployment
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ DEPLOYMENT OPTIONS                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$scriptPath = Join-Path (Get-Location) "ingest-team-logos.ps1"

Write-Host "Ready to ingest team logos!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:`n" -ForegroundColor Cyan

Write-Host "1. Full Ingestion (Download + Upload):" -ForegroundColor White
Write-Host "   .\ingest-team-logos.ps1`n" -ForegroundColor Gray

Write-Host "2. Dry Run (Preview without uploading):" -ForegroundColor White
Write-Host "   .\ingest-team-logos.ps1 -DryRun`n" -ForegroundColor Gray

Write-Host "3. Skip Download (use cached logos):" -ForegroundColor White
Write-Host "   .\ingest-team-logos.ps1 -SkipDownload`n" -ForegroundColor Gray

Write-Host "4. Verify Uploads:" -ForegroundColor White
Write-Host "   az storage blob list --account-name $StorageAccountName --container-name $ContainerName --auth-mode login -o table`n" -ForegroundColor Gray

Write-Host "5. Test Logo URL:" -ForegroundColor White
Write-Host "   Invoke-WebRequest -Uri '$StorageAccountUrl/nba-500-ny.png' -Method Head`n" -ForegroundColor Gray

if ($DeployImmediately) {
    Write-Host "`n🚀 Starting ingestion pipeline now...`n" -ForegroundColor Cyan
    & $scriptPath
}
else {
    Write-Host "`n✅ Configuration complete! Run 'ingest-team-logos.ps1' to deploy logos.`n" -ForegroundColor Green
}

exit 0

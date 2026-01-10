<#
.SYNOPSIS
    Deploy Azure Front Door infrastructure for GBSV Dashboard

.DESCRIPTION
    This script deploys Azure Front Door with:
    - Path-based routing to Static Web App and Container Apps
    - WAF policy for API protection
    - Custom domain configuration

.PARAMETER Environment
    Target environment (dev, staging, prod)

.PARAMETER ResourceGroup
    Resource group name for Front Door resources

.PARAMETER Location
    Azure region (Front Door is global, but RG needs a location)

.PARAMETER SkipWaf
    Skip WAF policy creation

.PARAMETER CustomDomainOnly
    Only configure custom domain (requires existing Front Door)

.EXAMPLE
    .\deploy-frontdoor.ps1 -Environment prod

.EXAMPLE
    .\deploy-frontdoor.ps1 -Environment prod -CustomDomainOnly
#>

param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'prod',
    
    [string]$ResourceGroup = 'dashboard-gbsv-main-rg',
    
    [string]$Location = 'eastus',
    
    [switch]$SkipWaf,
    
    [switch]$CustomDomainOnly,
    
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'

# ════════════════════════════════════════════════════════════════════════════
# Configuration
# ════════════════════════════════════════════════════════════════════════════

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir = $ScriptDir
$CustomDomainName = 'www.greenbiersportventures.com'

# Colors for output
function Write-Status {
    param([string]$Message, [string]$Type = 'Info')
    switch ($Type) {
        'Success' { Write-Host "✅ $Message" -ForegroundColor Green }
        'Warning' { Write-Host "⚠️  $Message" -ForegroundColor Yellow }
        'Error'   { Write-Host "❌ $Message" -ForegroundColor Red }
        'Info'    { Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
        'Step'    { Write-Host "`n🔷 $Message" -ForegroundColor Blue }
    }
}

# ════════════════════════════════════════════════════════════════════════════
# Pre-flight Checks
# ════════════════════════════════════════════════════════════════════════════

Write-Status "GBSV Dashboard - Azure Front Door Deployment" -Type Step
Write-Host "Environment: $Environment"
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Location: $Location"
Write-Host ""

# Check Azure CLI
Write-Status "Checking Azure CLI..." -Type Info
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Status "Azure CLI version: $($azVersion.'azure-cli')" -Type Success
} catch {
    Write-Status "Azure CLI not found. Please install: https://aka.ms/installazurecli" -Type Error
    exit 1
}

# Check login
Write-Status "Checking Azure login..." -Type Info
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Status "Logged in as: $($account.user.name)" -Type Success
    Write-Status "Subscription: $($account.name)" -Type Info
} catch {
    Write-Status "Not logged in. Running 'az login'..." -Type Warning
    az login
    $account = az account show --output json | ConvertFrom-Json
}

# Ensure resource group exists
Write-Status "Checking resource group..." -Type Step
$rgExists = az group exists --name $ResourceGroup
if ($rgExists -eq 'false') {
    Write-Status "Creating resource group: $ResourceGroup" -Type Info
    az group create --name $ResourceGroup --location $Location
    Write-Status "Resource group created" -Type Success
} else {
    Write-Status "Resource group exists: $ResourceGroup" -Type Success
}

# ════════════════════════════════════════════════════════════════════════════
# Deploy Front Door Infrastructure
# ════════════════════════════════════════════════════════════════════════════

if (-not $CustomDomainOnly) {
    Write-Status "Deploying Azure Front Door infrastructure..." -Type Step
    
    $bicepFile = Join-Path $InfraDir "main.bicep"
    $paramsFile = Join-Path $InfraDir "main.bicepparam"
    
    if (-not (Test-Path $bicepFile)) {
        Write-Status "Bicep file not found: $bicepFile" -Type Error
        exit 1
    }
    
    $deploymentName = "frontdoor-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    $deployParams = @(
        'deployment', 'group', 'create',
        '--resource-group', $ResourceGroup,
        '--name', $deploymentName,
        '--template-file', $bicepFile,
        '--parameters', "environment=$Environment",
        '--parameters', "enableWaf=$(-not $SkipWaf)"
    )
    
    if (Test-Path $paramsFile) {
        $deployParams += @('--parameters', "@$paramsFile")
    }
    
    if ($WhatIf) {
        $deployParams += '--what-if'
        Write-Status "Running in What-If mode..." -Type Warning
    }
    
    Write-Status "Starting deployment: $deploymentName" -Type Info
    Write-Host ""
    
    $result = & az @deployParams 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Deployment failed!" -Type Error
        Write-Host $result
        exit 1
    }
    
    if (-not $WhatIf) {
        $outputs = $result | ConvertFrom-Json
        
        Write-Host ""
        Write-Status "Deployment successful!" -Type Success
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host "  FRONT DOOR DEPLOYMENT RESULTS" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Front Door Name:     $($outputs.properties.outputs.frontDoorName.value)"
        Write-Host "  Endpoint Hostname:   $($outputs.properties.outputs.frontDoorEndpointHostname.value)"
        Write-Host "  Endpoint URL:        $($outputs.properties.outputs.frontDoorUrl.value)"
        Write-Host ""
        
        # Save outputs for later use
        $outputsFile = Join-Path $InfraDir "deployment-outputs.json"
        $outputs.properties.outputs | ConvertTo-Json -Depth 10 | Set-Content $outputsFile
        Write-Status "Outputs saved to: $outputsFile" -Type Info
    }
}

# ════════════════════════════════════════════════════════════════════════════
# Custom Domain Configuration Instructions
# ════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Status "Custom Domain Configuration" -Type Step
Write-Host ""
Write-Host "To add your custom domain ($CustomDomainName):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Get the Front Door endpoint hostname:"
Write-Host "   az afd endpoint show --profile-name gbsv-frontdoor-$Environment \"
Write-Host "     --resource-group $ResourceGroup --endpoint-name gbsv-endpoint-$Environment \"
Write-Host "     --query hostName -o tsv"
Write-Host ""
Write-Host "2. Add a CNAME record in your DNS:"
Write-Host "   - Name: www"
Write-Host "   - Type: CNAME"
Write-Host "   - Value: <endpoint-hostname>.azurefd.net"
Write-Host ""
Write-Host "3. Add custom domain to Front Door:"
Write-Host "   az afd custom-domain create --profile-name gbsv-frontdoor-$Environment \"
Write-Host "     --resource-group $ResourceGroup --custom-domain-name www-greenbiersportventures-com \"
Write-Host "     --host-name $CustomDomainName --certificate-type ManagedCertificate"
Write-Host ""
Write-Host "4. Wait for domain validation (may take 5-10 minutes)"
Write-Host ""
Write-Host "5. Associate custom domain with routes:"
Write-Host "   az afd route update --profile-name gbsv-frontdoor-$Environment \"
Write-Host "     --resource-group $ResourceGroup --endpoint-name gbsv-endpoint-$Environment \"
Write-Host "     --route-name route-dashboard --custom-domains www-greenbiersportventures-com"
Write-Host ""

# ════════════════════════════════════════════════════════════════════════════
# Update DNS Instructions
# ════════════════════════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DNS MIGRATION STEPS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Your domain currently points to Azure Static Web Apps."
Write-Host "To migrate to Azure Front Door:"
Write-Host ""
Write-Host "1. First, remove the custom domain from Static Web Apps:"
Write-Host "   az staticwebapp hostname delete --name gbsv-dashboard \"
Write-Host "     --hostname $CustomDomainName"
Write-Host ""
Write-Host "2. Add the custom domain to Front Door (see steps above)"
Write-Host ""
Write-Host "3. Update your DNS CNAME record to point to Front Door"
Write-Host ""
Write-Host "4. Update client/config.js API_BASE_URL to use Front Door endpoint"
Write-Host ""

Write-Status "Deployment script completed!" -Type Success

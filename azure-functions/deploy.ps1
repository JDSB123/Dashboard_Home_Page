# Azure Functions Deployment Script (PowerShell)
# Deploy the GBSV Model Orchestrator to Azure

$ErrorActionPreference = "Stop"

# Configuration
$ResourceGroup = "dashboard-gbsv-main-rg"
$FunctionAppName = "gbsv-orchestrator"
$StorageAccount = "gbsvorchestratorstorage"
$Location = "eastus"
$Runtime = "node"
$RuntimeVersion = "18"
$SignalRServiceName = "gbsv-signalr"
$SignalRSku = "Free_F1"
$SignalRServiceMode = "Serverless"

Write-Host "Starting deployment of GBSV Model Orchestrator" -ForegroundColor Green

# Check if logged in to Azure
Write-Host "Checking Azure login status..."
try {
    $account = az account show 2>$null | ConvertFrom-Json
    Write-Host "Using subscription: $($account.name)" -ForegroundColor Green
}
catch {
    Write-Host "Not logged in to Azure. Please run 'az login' first." -ForegroundColor Red
    exit 1
}

# Check if resource group exists
Write-Host "Checking resource group..."
$rgExists = az group exists --name $ResourceGroup
if ($rgExists -eq "false") {
    Write-Host "Resource group $ResourceGroup does not exist. Creating..." -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location
}
else {
    Write-Host "Resource group $ResourceGroup exists" -ForegroundColor Green
}

# Check if storage account exists
Write-Host "Checking storage account..."
$storageExists = az storage account show --name $StorageAccount --resource-group $ResourceGroup 2>$null
if (!$storageExists) {
    Write-Host "Creating storage account $StorageAccount..." -ForegroundColor Yellow
    az storage account create `
        --name $StorageAccount `
        --location $Location `
        --resource-group $ResourceGroup `
        --sku Standard_LRS `
        --kind StorageV2
}
else {
    Write-Host "Storage account $StorageAccount exists" -ForegroundColor Green
}

# Get storage connection string
Write-Host "Getting storage connection string..."
$StorageConnection = az storage account show-connection-string `
    --resource-group $ResourceGroup `
    --name $StorageAccount `
    --query connectionString -o tsv

# Create required storage containers
Write-Host "Creating storage containers..."
az storage container create --name model-results --connection-string $StorageConnection 2>$null
az storage queue create --name model-jobs --connection-string $StorageConnection 2>$null
az storage table create --name modelexecutions --connection-string $StorageConnection 2>$null
az storage table create --name modelregistry --connection-string $StorageConnection 2>$null

# Check if function app exists
Write-Host "Checking function app..."
$funcExists = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup 2>$null
if (!$funcExists) {
    Write-Host "Creating function app $FunctionAppName..." -ForegroundColor Yellow
    az functionapp create `
        --resource-group $ResourceGroup `
        --consumption-plan-location $Location `
        --runtime $Runtime `
        --runtime-version $RuntimeVersion `
        --functions-version 4 `
        --name $FunctionAppName `
        --storage-account $StorageAccount `
        --os-type Linux
}
else {
    Write-Host "Function app $FunctionAppName exists" -ForegroundColor Green
}

# Enable managed identity
Write-Host "Enabling managed identity..."
$Identity = az functionapp identity assign `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --query principalId -o tsv

Write-Host "Managed Identity Principal ID: $Identity" -ForegroundColor Green

# Ensure SignalR service is provisioned
Write-Host "Ensuring SignalR service '$SignalRServiceName' exists..."
try {
    $signalrService = az signalr show `
        --name $SignalRServiceName `
        --resource-group $ResourceGroup | ConvertFrom-Json
}
catch {
    Write-Host "SignalR service not found; it will be created." -ForegroundColor Yellow
    $signalrService = $null
}

if (-not $signalrService) {
    az signalr create `
        --name $SignalRServiceName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku $SignalRSku `
        --service-mode $SignalRServiceMode
    $signalrService = az signalr show `
        --name $SignalRServiceName `
        --resource-group $ResourceGroup | ConvertFrom-Json
}
elseif ($signalrService.properties.serviceMode -ne $SignalRServiceMode -or $signalrService.sku.name -ne $SignalRSku) {
    Write-Host "Updating SignalR service configuration to match required settings..." -ForegroundColor Yellow
    az signalr update `
        --name $SignalRServiceName `
        --resource-group $ResourceGroup `
        --sku $SignalRSku `
        --service-mode $SignalRServiceMode
    $signalrService = az signalr show `
        --name $SignalRServiceName `
        --resource-group $ResourceGroup | ConvertFrom-Json
}

Write-Host "Retrieving SignalR connection string..."
$SignalRConnectionString = az signalr key list `
    --name $SignalRServiceName `
    --resource-group $ResourceGroup `
    --query primaryConnectionString -o tsv

if (-not $SignalRConnectionString) {
    Write-Host "Failed to read SignalR connection string; aborting." -ForegroundColor Red
    exit 1
}

# Configure application settings
Write-Host "Configuring application settings..."
$settings = @(
    "AzureWebJobsStorage=$StorageConnection",
    "AzureSignalRConnectionString=$SignalRConnectionString",
    "WEBSITE_RUN_FROM_PACKAGE=1",
    "FUNCTIONS_WORKER_RUNTIME=node",
    "NBA_API_URL=https://www.greenbiersportventures.com/api/nba",
    "NCAAM_API_URL=https://www.greenbiersportventures.com/api/ncaam",
    "NFL_API_URL=https://www.greenbiersportventures.com/api/nfl",
    "NCAAF_API_URL=https://www.greenbiersportventures.com/api/ncaaf"
)

az functionapp config appsettings set `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --settings $settings

# Enable CORS
Write-Host "Configuring CORS..."
az functionapp cors add `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --allowed-origins "https://www.greenbiersportventures.com" "http://localhost:8080"

# Install npm dependencies
Write-Host "Installing dependencies..."
npm install

# Create deployment package
Write-Host "Creating deployment package..."
if (Test-Path deployment.zip) {
    Remove-Item deployment.zip
}

# Use PowerShell compression
Compress-Archive -Path * -DestinationPath deployment.zip `
    -CompressionLevel Optimal `
    -Force `
    -Exclude @("*.git*", "node_modules", "local.settings.json", "deploy.ps1", "deploy.sh", "*.md", "deployment.zip")

# Deploy to Azure
Write-Host "Deploying to Azure..."
az functionapp deployment source config-zip `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --src deployment.zip

# Clean up
Remove-Item deployment.zip

# Get function app URL
$FunctionUrl = az functionapp show `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --query defaultHostName -o tsv

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "Function App URL: https://$FunctionUrl" -ForegroundColor Green
Write-Host "Orchestrator API: https://$FunctionUrl/api" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Grant RBAC permissions to the managed identity for accessing model Container Apps"
Write-Host "2. Update dashboard config with the orchestrator URL"
Write-Host "3. (Optional) Verify the AzureSignalRConnectionString app setting if you customized the SignalR service"
Write-Host ""
Write-Host "To grant RBAC permissions, run:" -ForegroundColor Yellow
Write-Host "az role assignment create --role 'Container Apps Reader' --assignee $Identity --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/nba-gbsv-model-rg"
Write-Host "az role assignment create --role 'Container Apps Reader' --assignee $Identity --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/nfl-gbsv-model-rg"
Write-Host "az role assignment create --role 'Container Apps Reader' --assignee $Identity --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/ncaam-gbsv-model-rg"
Write-Host "az role assignment create --role 'Container Apps Reader' --assignee $Identity --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/ncaaf-gbsv-model-rg"

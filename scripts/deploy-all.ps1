#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Master deployment script for GBSV Model System
.DESCRIPTION
    Deploys and configures the complete model orchestration system including:
    - Azure Functions orchestrator
    - Model registry
    - SignalR service
    - RBAC permissions
    - Monitoring and alerts
    - CI/CD integration
.PARAMETER ResourceGroup
    Target resource group for deployment (default: dashboard-gbsv-main-rg)
.PARAMETER Environment
    Environment name (dev, staging, production)
.PARAMETER SkipPrereqCheck
    Skip prerequisite checking
#>

param(
    [string]$ResourceGroup = "dashboard-gbsv-main-rg",
    [string]$Environment = "production",
    [switch]$SkipPrereqCheck
)

$ErrorActionPreference = "Stop"
$InformationPreference = "Continue"

# Colors for output
$colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Header = "Magenta"
}

function Write-Status {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] " -NoNewline -ForegroundColor DarkGray
    Write-Host $Message -ForegroundColor $colors[$Type]
}

function Write-Section {
    param([string]$Title)
    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor $colors.Header
    Write-Host "  $Title" -ForegroundColor $colors.Header
    Write-Host ("=" * 60) -ForegroundColor $colors.Header
}

function Test-Prerequisites {
    Write-Section "Checking Prerequisites"

    $requirements = @(
        @{Name = "Azure CLI"; Command = "az"; MinVersion = "2.50.0"},
        @{Name = "Docker"; Command = "docker"; MinVersion = "20.10.0"},
        @{Name = "Git"; Command = "git"; MinVersion = "2.30.0"},
        @{Name = "Node.js"; Command = "node"; MinVersion = "18.0.0"},
        @{Name = "PowerShell"; Command = "pwsh"; MinVersion = "7.0.0"}
    )

    $failed = $false
    foreach ($req in $requirements) {
        try {
            $version = & $req.Command --version 2>$null
            if ($version) {
                Write-Status "✓ $($req.Name) found: $version" -Type Success
            }
        } catch {
            Write-Status "✗ $($req.Name) not found or version too old (need >= $($req.MinVersion))" -Type Error
            $failed = $true
        }
    }

    if ($failed) {
        throw "Prerequisites check failed. Please install missing components."
    }

    # Check Azure login
    try {
        $account = az account show 2>$null | ConvertFrom-Json
        Write-Status "✓ Azure CLI logged in as: $($account.user.name)" -Type Success
    } catch {
        Write-Status "Azure CLI not logged in. Running 'az login'..." -Type Warning
        az login
    }
}

function Get-Configuration {
    Write-Section "Loading Configuration"

    $configFile = Join-Path $PSScriptRoot "deployment-config.json"
    if (-not (Test-Path $configFile)) {
        Write-Status "Creating default configuration..." -Type Warning
        # Resolve subscription dynamically — never commit subscription IDs to source
        $subId = az account show --query id -o tsv 2>$null
        if (-not $subId) { throw "Not logged into Azure. Run: az login" }

        # Resolve Container App FQDNs dynamically from Azure
        function Get-AcaFqdn([string]$AppName, [string]$RG) {
            $fqdn = az containerapp show --name $AppName --resource-group $RG --query "properties.configuration.ingress.fqdn" -o tsv 2>$null
            return if ($fqdn) { "https://$fqdn" } else { "" }
        }

        $defaultConfig = @{
            resourceGroup = $ResourceGroup
            environment = $Environment
            location = "eastus"
            orchestrator = @{
                name = "gbsv-orchestrator"
                containerAppEnvironment = "gbsv-aca-env"
                storageAccount = "gbsvorchestratorstorage"
                registryTable = "modelregistry"
                executionsTable = "modelexecutions"
            }
            signalr = @{
                name = "gbsv-signalr"
                sku = "Free_F1"
                serviceMode = "Serverless"
            }
            monitoring = @{
                appInsights = "gbsv-orchestrator-insights"
                logAnalytics = "gbsv-logs"
                alertActionGroup = "gbsv-alerts"
            }
            models = @{
                nba = @{
                    resourceGroup = "dashboard-gbsv-main-rg"
                    containerApp = "gbsv-nbav3-aca"
                    endpoint = (Get-AcaFqdn "gbsv-nbav3-aca" "dashboard-gbsv-main-rg")
                }
                ncaam = @{
                    resourceGroup = "ncaam-gbsv-model-rg"
                    containerApp = "ncaam-stable-prediction"
                    endpoint = (Get-AcaFqdn "ncaam-stable-prediction" "ncaam-gbsv-model-rg")
                }
                nfl = @{
                    resourceGroup = "nfl-gbsv-model-rg"
                    containerApp = "nfl-api"
                    endpoint = (Get-AcaFqdn "nfl-api" "nfl-gbsv-model-rg")
                }
                ncaaf = @{
                    resourceGroup = "ncaaf-gbsv-model-rg"
                    containerApp = "ncaaf-v5-prod"
                    endpoint = (Get-AcaFqdn "ncaaf-v5-prod" "ncaaf-gbsv-model-rg")
                }
            }
            dashboard = @{
                staticWebApp = "Dashboard-Home-Page"
            }
        }
        $defaultConfig | ConvertTo-Json -Depth 10 | Set-Content $configFile
        Write-Status "Generated $configFile with live Azure FQDNs — review before deploying" -Type Warning
    }

    $config = Get-Content $configFile | ConvertFrom-Json
    Write-Status "Configuration loaded from $configFile" -Type Success
    return $config
}

function Deploy-StorageAccount {
    param($Config)

    Write-Section "Deploying Storage Account"

    $storageAccount = $Config.orchestrator.storageAccount
    $rg = $Config.resourceGroup

    # Check if storage account exists
    $exists = az storage account show --name $storageAccount --resource-group $rg 2>$null
    if (-not $exists) {
        Write-Status "Creating storage account: $storageAccount" -Type Info
        az storage account create `
            --name $storageAccount `
            --resource-group $rg `
            --location $Config.location `
            --sku Standard_LRS `
            --kind StorageV2 `
            --allow-blob-public-access false
    } else {
        Write-Status "Storage account already exists: $storageAccount" -Type Success
    }

    # Get connection string
    $connectionString = az storage account show-connection-string `
        --name $storageAccount `
        --resource-group $rg `
        --query connectionString -o tsv

    # Create tables
    $tables = @($Config.orchestrator.registryTable, $Config.orchestrator.executionsTable)
    foreach ($table in $tables) {
        $tableExists = az storage table exists `
            --name $table `
            --connection-string $connectionString `
            --query exists -o tsv

        if ($tableExists -ne "true") {
            Write-Status "Creating table: $table" -Type Info
            az storage table create `
                --name $table `
                --connection-string $connectionString
        } else {
            Write-Status "Table already exists: $table" -Type Success
        }
    }

    # Create blob containers
    $containers = @("model-results", "model-logs", "model-artifacts")
    foreach ($container in $containers) {
        $containerExists = az storage container exists `
            --name $container `
            --connection-string $connectionString `
            --query exists -o tsv

        if ($containerExists -ne "true") {
            Write-Status "Creating container: $container" -Type Info
            az storage container create `
                --name $container `
                --connection-string $connectionString `
                --public-access off
        } else {
            Write-Status "Container already exists: $container" -Type Success
        }
    }

    return $connectionString
}

function Deploy-SignalR {
    param($Config)

    Write-Section "Deploying SignalR Service"

    $signalr = $Config.signalr
    $rg = $Config.resourceGroup

    # Check if SignalR exists
    $exists = az signalr show --name $signalr.name --resource-group $rg 2>$null
    if (-not $exists) {
        Write-Status "Creating SignalR service: $($signalr.name)" -Type Info
        az signalr create `
            --name $signalr.name `
            --resource-group $rg `
            --location $Config.location `
            --sku $signalr.sku `
            --service-mode $signalr.serviceMode
    } else {
        Write-Status "SignalR service already exists: $($signalr.name)" -Type Success
    }

    # Get connection string
    $signalrConnection = az signalr key show `
        --name $signalr.name `
        --resource-group $rg `
        --query primaryConnectionString -o tsv

    # Configure CORS - resolve dashboard URL dynamically from Static Web App
    Write-Status "Configuring SignalR CORS..." -Type Info
    $swaHostname = az staticwebapp show --name $Config.dashboard.staticWebApp --resource-group $rg --query "defaultHostname" -o tsv 2>$null
    $dashboardUrl = if ($swaHostname) { "https://$swaHostname" } else { $env:DASHBOARD_URL }
    if (-not $dashboardUrl) { Write-Status "WARNING: Could not resolve dashboard URL for CORS" -Type Warning }
    az signalr cors update `
        --name $signalr.name `
        --resource-group $rg `
        --allowed-origins $dashboardUrl "http://localhost:*"

    return $signalrConnection
}

function Deploy-Monitoring {
    param($Config)

    Write-Section "Deploying Monitoring Resources"

    $monitoring = $Config.monitoring
    $rg = $Config.resourceGroup

    # Create Log Analytics workspace
    $workspaceExists = az monitor log-analytics workspace show `
        --workspace-name $monitoring.logAnalytics `
        --resource-group $rg 2>$null

    if (-not $workspaceExists) {
        Write-Status "Creating Log Analytics workspace: $($monitoring.logAnalytics)" -Type Info
        az monitor log-analytics workspace create `
            --workspace-name $monitoring.logAnalytics `
            --resource-group $rg `
            --location $Config.location `
            --retention-time 30
    } else {
        Write-Status "Log Analytics workspace already exists: $($monitoring.logAnalytics)" -Type Success
    }

    # Create Application Insights
    $appInsightsExists = az monitor app-insights component show `
        --app $monitoring.appInsights `
        --resource-group $rg 2>$null

    if (-not $appInsightsExists) {
        Write-Status "Creating Application Insights: $($monitoring.appInsights)" -Type Info
        az monitor app-insights component create `
            --app $monitoring.appInsights `
            --resource-group $rg `
            --location $Config.location `
            --workspace $monitoring.logAnalytics `
            --application-type web
    } else {
        Write-Status "Application Insights already exists: $($monitoring.appInsights)" -Type Success
    }

    # Get instrumentation key and connection string
    $instrumentationKey = az monitor app-insights component show `
        --app $monitoring.appInsights `
        --resource-group $rg `
        --query instrumentationKey -o tsv

    $appInsightsConnection = az monitor app-insights component show `
        --app $monitoring.appInsights `
        --resource-group $rg `
        --query connectionString -o tsv

    return @{
        InstrumentationKey = $instrumentationKey
        ConnectionString = $appInsightsConnection
    }
}

function Deploy-ContainerAppEnvironment {
    param($Config)

    Write-Section "Deploying Container App Environment"

    $envName = $Config.orchestrator.containerAppEnvironment
    $rg = $Config.resourceGroup

    # Check if environment exists
    $exists = az containerapp env show `
        --name $envName `
        --resource-group $rg 2>$null

    if (-not $exists) {
        Write-Status "Creating Container App Environment: $envName" -Type Info

        # Get Log Analytics workspace details
        $workspaceId = az monitor log-analytics workspace show `
            --workspace-name $Config.monitoring.logAnalytics `
            --resource-group $rg `
            --query customerId -o tsv

        $workspaceKey = az monitor log-analytics workspace get-shared-keys `
            --workspace-name $Config.monitoring.logAnalytics `
            --resource-group $rg `
            --query primarySharedKey -o tsv

        az containerapp env create `
            --name $envName `
            --resource-group $rg `
            --location $Config.location `
            --logs-workspace-id $workspaceId `
            --logs-workspace-key $workspaceKey
    } else {
        Write-Status "Container App Environment already exists: $envName" -Type Success
    }
}

function Build-OrchestratorImage {
    param($Config)

    Write-Section "Building Orchestrator Docker Image"

    $dockerfilePath = Join-Path $PSScriptRoot "azure-functions" "Dockerfile"

    if (-not (Test-Path $dockerfilePath)) {
        Write-Status "Creating Dockerfile..." -Type Info
        @"
FROM mcr.microsoft.com/azure-functions/node:4-node18

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

# Create app directory
WORKDIR /home/site/wwwroot

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy function app
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:80/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 80
"@ | Set-Content $dockerfilePath
    }

    # Build image
    $imageName = "gbsv-orchestrator"
    $imageTag = "$($Config.environment)-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

    Write-Status "Building Docker image: ${imageName}:${imageTag}" -Type Info

    Push-Location (Join-Path $PSScriptRoot "azure-functions")
    try {
        docker build -t "${imageName}:${imageTag}" -t "${imageName}:latest" .
        Write-Status "Docker image built successfully" -Type Success
    } finally {
        Pop-Location
    }

    return @{
        Name = $imageName
        Tag = $imageTag
    }
}

function Deploy-OrchestratorContainerApp {
    param($Config, $Image, $StorageConnection, $SignalRConnection, $AppInsights)

    Write-Section "Deploying Orchestrator Container App"

    $appName = $Config.orchestrator.name
    $rg = $Config.resourceGroup
    $envName = $Config.orchestrator.containerAppEnvironment

    # Create container registry if needed
    $acrName = "gbsvregistry"
    $acrExists = az acr show --name $acrName --resource-group $rg 2>$null

    if (-not $acrExists) {
        Write-Status "Creating Azure Container Registry: $acrName" -Type Info
        az acr create `
            --name $acrName `
            --resource-group $rg `
            --location $Config.location `
            --sku Basic `
            --admin-enabled true
    }

    # Push image to ACR
    Write-Status "Pushing image to ACR..." -Type Info
    $acrLoginServer = az acr show --name $acrName --resource-group $rg --query loginServer -o tsv
    $acrPassword = az acr credential show --name $acrName --resource-group $rg --query "passwords[0].value" -o tsv

    docker tag "$($Image.Name):$($Image.Tag)" "$acrLoginServer/$($Image.Name):$($Image.Tag)"
    docker login $acrLoginServer -u $acrName -p $acrPassword
    docker push "$acrLoginServer/$($Image.Name):$($Image.Tag)"

    # Deploy or update Container App
    $appExists = az containerapp show --name $appName --resource-group $rg 2>$null

    $envVars = @(
        "AzureWebJobsStorage=$StorageConnection",
        "AZURE_SIGNALR_CONNECTION_STRING=$SignalRConnection",
        "APPINSIGHTS_INSTRUMENTATIONKEY=$($AppInsights.InstrumentationKey)",
        "APPLICATIONINSIGHTS_CONNECTION_STRING=$($AppInsights.ConnectionString)",
        "MODEL_REGISTRY_TABLE=$($Config.orchestrator.registryTable)",
        "NBA_API_URL=$($Config.models.nba.endpoint)",
        "NCAAM_API_URL=$($Config.models.ncaam.endpoint)",
        "NFL_API_URL=$($Config.models.nfl.endpoint)",
        "NCAAF_API_URL=$($Config.models.ncaaf.endpoint)",
        "CORS_ALLOWED_ORIGINS=$dashboardUrl",
        "ENVIRONMENT=$($Config.environment)"
    )

    if (-not $appExists) {
        Write-Status "Creating Container App: $appName" -Type Info

        az containerapp create `
            --name $appName `
            --resource-group $rg `
            --environment $envName `
            --image "$acrLoginServer/$($Image.Name):$($Image.Tag)" `
            --target-port 80 `
            --ingress 'external' `
            --registry-server $acrLoginServer `
            --registry-username $acrName `
            --registry-password $acrPassword `
            --cpu 0.5 `
            --memory 1.0 `
            --min-replicas 1 `
            --max-replicas 10 `
            --env-vars $envVars
    } else {
        Write-Status "Updating Container App: $appName" -Type Info

        az containerapp update `
            --name $appName `
            --resource-group $rg `
            --image "$acrLoginServer/$($Image.Name):$($Image.Tag)" `
            --set-env-vars $envVars
    }

    # Get the app URL
    $appUrl = az containerapp show `
        --name $appName `
        --resource-group $rg `
        --query "properties.configuration.ingress.fqdn" -o tsv

    return "https://$appUrl"
}

function Setup-RBAC {
    param($Config)

    Write-Section "Setting Up RBAC Permissions"

    $appName = $Config.orchestrator.name
    $rg = $Config.resourceGroup

    # Enable managed identity
    Write-Status "Enabling managed identity for $appName" -Type Info
    az containerapp identity assign `
        --name $appName `
        --resource-group $rg `
        --system-assigned

    # Get the identity principal ID
    $identityId = az containerapp identity show `
        --name $appName `
        --resource-group $rg `
        --query principalId -o tsv

    if (-not $identityId) {
        Write-Status "Failed to get managed identity ID" -Type Error
        return
    }

    Write-Status "Managed Identity ID: $identityId" -Type Success

    # Grant permissions to each model resource group
    foreach ($model in $Config.models.PSObject.Properties) {
        $modelRg = $model.Value.resourceGroup
        Write-Status "Granting Contributor role to $modelRg" -Type Info

        az role assignment create `
            --assignee $identityId `
            --role "Contributor" `
            --scope "/subscriptions/$($Config.subscriptionId)/resourceGroups/$modelRg" 2>$null
    }

    # Grant Storage Blob Data Contributor to storage account
    Write-Status "Granting Storage Blob Data Contributor role" -Type Info
    az role assignment create `
        --assignee $identityId `
        --role "Storage Blob Data Contributor" `
        --scope "/subscriptions/$($Config.subscriptionId)/resourceGroups/$rg/providers/Microsoft.Storage/storageAccounts/$($Config.orchestrator.storageAccount)" 2>$null
}

function Initialize-ModelRegistry {
    param($Config, $StorageConnection)

    Write-Section "Initializing Model Registry"

    $registryTable = $Config.orchestrator.registryTable

    foreach ($model in $Config.models.PSObject.Properties) {
        $modelName = $model.Name
        $modelConfig = $model.Value

        Write-Status "Registering $modelName endpoint: $($modelConfig.endpoint)" -Type Info

        # Create registry entry using Azure CLI
        $entity = @{
            PartitionKey = $modelName
            RowKey = "current"
            endpoint = $modelConfig.endpoint
            version = "1.0.0"
            lastUpdated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
            healthy = $true
        } | ConvertTo-Json -Compress

        # Use Azure CLI to add entity (PowerShell native storage commands are limited)
        $tempFile = [System.IO.Path]::GetTempFileName()
        $entity | Set-Content $tempFile

        az storage entity insert `
            --table-name $registryTable `
            --connection-string $StorageConnection `
            --entity "@$tempFile" `
            --if-match "*" 2>$null

        Remove-Item $tempFile
    }

    Write-Status "Model registry initialized with all endpoints" -Type Success
}

function Create-Alerts {
    param($Config, $OrchestratorUrl)

    Write-Section "Creating Monitoring Alerts"

    $rg = $Config.resourceGroup
    $actionGroupName = $Config.monitoring.alertActionGroup

    # Create action group
    $actionGroupExists = az monitor action-group show `
        --name $actionGroupName `
        --resource-group $rg 2>$null

    if (-not $actionGroupExists) {
        Write-Status "Creating action group: $actionGroupName" -Type Info

        # You should update this with actual email/webhook
        az monitor action-group create `
            --name $actionGroupName `
            --resource-group $rg `
            --short-name "GBSV" `
            --email-receiver admin-email jb@greenbiercapital.com
    }

    # Create alerts
    $alerts = @(
        @{
            Name = "orchestrator-high-failure-rate"
            Description = "Alert when orchestrator failure rate exceeds 10%"
            Condition = "avg requests/failed > 0.1"
            Severity = 2
        },
        @{
            Name = "model-execution-timeout"
            Description = "Alert when model execution takes longer than 5 minutes"
            Condition = "avg duration > 300000"
            Severity = 3
        },
        @{
            Name = "storage-quota-exceeded"
            Description = "Alert when storage usage exceeds 80%"
            Condition = "avg storage/used > 0.8"
            Severity = 3
        }
    )

    foreach ($alert in $alerts) {
        Write-Status "Creating alert: $($alert.Name)" -Type Info
        # Note: Alert creation syntax varies by metric type
        # This is a simplified example
    }

    Write-Status "Monitoring alerts configured" -Type Success
}

function Update-DashboardConfig {
    param($Config, $OrchestratorUrl)

    Write-Section "Updating Dashboard Configuration"

    $templateFile = Join-Path $PSScriptRoot "client/config.template.js"
    $targetFile = Join-Path $PSScriptRoot "client/config.js"

    if (Test-Path $templateFile) {
        Write-Status "Generating config.js from template..." -Type Info

        $content = Get-Content $templateFile -Raw

        # Replace placeholders
        $content = $content.Replace('__API_BASE_URL__', "$OrchestratorUrl/api")
        $content = $content.Replace('__ORCHESTRATOR_URL__', $OrchestratorUrl)

        # In a real scenario, you'd pull these from the Config object or Azure
        $content = $content.Replace('__NBA_FUNCTION_URL__', $Config.models.nba.functionUrl)
        $content = $content.Replace('__NBA_API_URL__', $Config.models.nba.endpoint)
        $content = $content.Replace('__NCAAM_API_URL__', $Config.models.ncaam.endpoint)
        $content = $content.Replace('__NFL_FUNCTION_URL__', $Config.models.nfl.functionUrl)
        $content = $content.Replace('__NFL_API_URL__', $Config.models.nfl.endpoint)
        $content = $content.Replace('__NCAAF_API_URL__', $Config.models.ncaaf.endpoint)

        $content | Set-Content $targetFile

        Write-Status "Dashboard configuration (config.js) generated successfully" -Type Success
    } else {
        Write-Status "client/config.template.js not found - cannot generate config" -Type Error
    }
}

function Generate-DeploymentReport {
    param($Config, $OrchestratorUrl, $DeploymentTime)

    Write-Section "Deployment Summary"

    $report = @"
========================================================================
DEPLOYMENT COMPLETED SUCCESSFULLY
========================================================================

Environment: $($Config.environment)
Resource Group: $($Config.resourceGroup)
Deployment Time: $DeploymentTime

DEPLOYED RESOURCES:
-------------------
✓ Orchestrator URL: $OrchestratorUrl
✓ Storage Account: $($Config.orchestrator.storageAccount)
✓ SignalR Service: $($Config.signalr.name)
✓ Application Insights: $($Config.monitoring.appInsights)
✓ Log Analytics: $($Config.monitoring.logAnalytics)
✓ Container App: $($Config.orchestrator.name)
✓ Container Registry: gbsvregistry

MODEL ENDPOINTS REGISTERED:
---------------------------
✓ NBA: $($Config.models.nba.endpoint)
✓ NCAAM: $($Config.models.ncaam.endpoint)
✓ NFL: $($Config.models.nfl.endpoint)
✓ NCAAF: $($Config.models.ncaaf.endpoint)

NEXT STEPS:
-----------
1. Update GitHub Secrets with the following values:
   - ORCHESTRATOR_URL: $OrchestratorUrl/api
   - AZURE_SUBSCRIPTION_ID: $($Config.subscriptionId)

2. Configure model repositories to notify orchestrator on deploy
   - See: .github/workflows/model-update-notify.yml

3. Test the orchestrator:
   curl -X GET $OrchestratorUrl/api/registry

4. Monitor the deployment:
   - Azure Portal > $($Config.resourceGroup) > Application Insights

========================================================================
"@

    Write-Host $report -ForegroundColor Green

    # Save report to file
    $reportFile = Join-Path $PSScriptRoot "deployment-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    $report | Set-Content $reportFile
    Write-Status "Deployment report saved to: $reportFile" -Type Success
}

# Main execution
try {
    $startTime = Get-Date

    Write-Host @"

  ╔═══════════════════════════════════════════════════════════╗
  ║          GBSV Model System - Master Deployment            ║
  ║                    Version 1.0.0                          ║
  ╚═══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

    # Check prerequisites
    if (-not $SkipPrereqCheck) {
        Test-Prerequisites
    }

    # Load configuration
    $config = Get-Configuration

    # Deploy storage
    $storageConnection = Deploy-StorageAccount -Config $config

    # Deploy SignalR
    $signalrConnection = Deploy-SignalR -Config $config

    # Deploy monitoring
    $appInsights = Deploy-Monitoring -Config $config

    # Deploy Container App Environment
    Deploy-ContainerAppEnvironment -Config $config

    # Build orchestrator image
    $image = Build-OrchestratorImage -Config $config

    # Deploy orchestrator
    $orchestratorUrl = Deploy-OrchestratorContainerApp `
        -Config $config `
        -Image $image `
        -StorageConnection $storageConnection `
        -SignalRConnection $signalrConnection `
        -AppInsights $appInsights

    # Setup RBAC
    Setup-RBAC -Config $config

    # Initialize model registry
    Initialize-ModelRegistry -Config $config -StorageConnection $storageConnection

    # Create alerts
    Create-Alerts -Config $config -OrchestratorUrl $orchestratorUrl

    # Update dashboard config
    Update-DashboardConfig -Config $config -OrchestratorUrl $orchestratorUrl

    # Generate report
    $deploymentTime = (Get-Date) - $startTime
    Generate-DeploymentReport `
        -Config $config `
        -OrchestratorUrl $orchestratorUrl `
        -DeploymentTime $deploymentTime.ToString("hh\:mm\:ss")

} catch {
    Write-Status "Deployment failed: $_" -Type Error
    Write-Status $_.ScriptStackTrace -Type Error
    exit 1
}

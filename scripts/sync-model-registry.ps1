#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sync the orchestrator registry with the current Container App FQDNs across multiple resource groups.
.DESCRIPTION
    - Looks up each model's Container App ingress FQDN via Azure CLI.
    - Posts the endpoint to the orchestrator /registry/update API so the dashboard registry stays current.
    - Use in CI (with azure/login) or locally after az login.
.EXAMPLE
    pwsh ./scripts/sync-model-registry.ps1 `
      -SubscriptionId 00000000-0000-0000-0000-000000000000 `
      -OrchestratorUrl https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io/api `
      -ModelsJson '[{"model":"nba","resourceGroup":"nba-gbsv-model-rg","appName":"nba-gbsv-api"}]'
.NOTES
    Requires Azure CLI authenticated to the subscription that holds the model Container Apps.
#>

param(
    [string]$SubscriptionId = "",
    [string]$OrchestratorUrl = "https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io/api",
    [string]$ModelsJson = "",
    [string]$FunctionsKey = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Default models; override with -ModelsJson if your RG/app names differ.
$defaultModels = @(
    @{ model = "nba";   resourceGroup = "nba-gbsv-model-rg";   appName = "nba-gbsv-api" },
    @{ model = "ncaam"; resourceGroup = "ncaam-gbsv-model-rg"; appName = "ncaam-stable-prediction" },
    @{ model = "nfl";   resourceGroup = "nfl-gbsv-model-rg";   appName = "nfl-api" },
    @{ model = "ncaaf"; resourceGroup = "ncaaf-gbsv-model-rg"; appName = "ncaaf-v5-prod" }
)

function Get-Models {
    param([string]$Json, [array]$Fallback)
    if ($Json) {
        try {
            $parsed = $Json | ConvertFrom-Json
            if ($parsed) { return $parsed }
        } catch {
            throw "Failed to parse ModelsJson. Provide valid JSON array of {model, resourceGroup, appName}."
        }
    }
    return $Fallback
}

function Ensure-AzLogin {
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        throw "Azure CLI not found. Install Azure CLI or run inside a GitHub Actions job with azure/login."
    }
    $account = az account show 2>$null | ConvertFrom-Json
    if (-not $account) {
        throw "Not logged in to Azure CLI. Run az login or azure/login first."
    }
    return $account
}

function Set-Subscription {
    param([string]$SubscriptionId)
    if ($SubscriptionId) {
        az account set --subscription $SubscriptionId | Out-Null
    }
    $active = az account show | ConvertFrom-Json
    Write-Host "Using subscription: $($active.name) ($($active.id))" -ForegroundColor Cyan
    return $active
}

function Get-ContainerAppFqdn {
    param(
        [string]$ResourceGroup,
        [string]$AppName
    )
    $fqdnOutput = az containerapp show `
        --name $AppName `
        --resource-group $ResourceGroup `
        --query "properties.configuration.ingress.fqdn" `
        -o tsv 2>&1

    if ($LASTEXITCODE -ne 0) {
        $msg = ($fqdnOutput | Out-String).Trim()
        throw "az containerapp show failed for $AppName in $ResourceGroup: $msg"
    }

    $fqdn = ($fqdnOutput | Out-String).Trim()
    if (-not $fqdn) {
        throw "Ingress FQDN empty for $AppName in $ResourceGroup (ingress disabled or app missing)"
    }
    return $fqdn
}

function Update-Registry {
    param(
        [string]$Url,
        [string]$Model,
        [string]$Endpoint,
        [string]$Version,
        [string]$Timestamp,
        [string]$FunctionsKey,
        [switch]$DryRun
    )

    if ($DryRun) {
        Write-Host "[DRY RUN] Would update $Model => $Endpoint" -ForegroundColor Yellow
        return
    }

    $headers = @{ "Content-Type" = "application/json" }
    if ($FunctionsKey) {
        $headers["x-functions-key"] = $FunctionsKey
    }

    $payload = @{
        model     = $Model
        endpoint  = $Endpoint
        version   = $Version
        timestamp = $Timestamp
    } | ConvertTo-Json -Compress

    Invoke-RestMethod -Method Post -Uri $Url -Body $payload -Headers $headers -TimeoutSec 25 | Out-Null
}

# Normalize orchestrator API base
$apiBase = $OrchestratorUrl.TrimEnd("/")
if ($apiBase -notmatch "/api$") {
    $apiBase = "$apiBase/api"
}
$registryUrl = "$apiBase/registry/update"

$models = Get-Models -Json $ModelsJson -Fallback $defaultModels
if (-not $models -or $models.Count -eq 0) {
    throw "No models configured. Provide -ModelsJson."
}

Ensure-AzLogin | Out-Null
Set-Subscription -SubscriptionId $SubscriptionId | Out-Null

$timestamp = (Get-Date -AsUTC).ToString("o")
$version = "auto-sync"

Write-Host "Registry endpoint: $registryUrl" -ForegroundColor Green

foreach ($m in $models) {
    $model = $m.model
    $rg = $m.resourceGroup
    $app = $m.appName

    if (-not $model -or -not $rg -or -not $app) {
        Write-Warning "Skipping entry with missing fields: $($m | ConvertTo-Json -Compress)"
        continue
    }

    Write-Host "Resolving $model from $rg/$app ..." -ForegroundColor Cyan
    try {
        $fqdn = Get-ContainerAppFqdn -ResourceGroup $rg -AppName $app
        $endpoint = "https://$fqdn"
        Write-Host " -> $endpoint" -ForegroundColor DarkGray
        Update-Registry -Url $registryUrl -Model $model -Endpoint $endpoint -Version $version -Timestamp $timestamp -FunctionsKey $FunctionsKey -DryRun:$DryRun
        Write-Host "Updated $model" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to update $model ($rg/$app): $($_.Exception.Message)"
    }
}

Write-Host "Model registry sync complete." -ForegroundColor Green

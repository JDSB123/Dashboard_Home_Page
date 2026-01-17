# 🚀 GBSV Model System - Complete Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy the complete GBSV Model System, including orchestrator, monitoring, pick analysis, and CI/CD integration.

## ✅ Prerequisites

Before starting, ensure you have:

- **Azure Subscription** with appropriate permissions
- **Azure CLI** installed (v2.50.0+)
- **Docker** installed (v20.10.0+)
- **PowerShell 7+** (Windows) or **Bash** (Mac/Linux)
- **Git** configured with repository access
- **Node.js 18+** for local development

## 📋 Quick Start (Automated)

### Option 1: PowerShell (Recommended for Windows)

```powershell
# 1. Clone repository
git clone https://github.com/JDSB123/Dashboard_Home_Page.git
cd Dashboard_Home_Page

# 2. Run automated deployment
\scripts\deploy-all.ps1 -Environment production

# 3. Follow the prompts and wait for completion
```

### Option 2: GitHub Actions (CI/CD)

1. Go to GitHub Actions tab
2. Select "Deploy Complete Model System"
3. Click "Run workflow"
4. Select environment and options
5. Monitor deployment progress

## 🔧 Manual Setup (Step-by-Step)

### Step 1: Configure Environment

```bash
# Copy environment template
cp env.template .env

# Edit .env with your values
# IMPORTANT: Update all placeholder values
```

### Step 2: Azure Login

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### Step 3: Create Resource Group

```bash
# Create main resource group
az group create \
  --name dashboard-gbsv-main-rg \
  --location eastus
```

### Step 4: Deploy Storage

```bash
# Create storage account
az storage account create \
  --name gbsvorchestratorstorage \
  --resource-group dashboard-gbsv-main-rg \
  --location eastus \
  --sku Standard_LRS

# Get connection string
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name gbsvorchestratorstorage \
  --resource-group dashboard-gbsv-main-rg \
  --query connectionString -o tsv)

# Create tables
az storage table create --name modelregistry --connection-string "$STORAGE_CONNECTION"
az storage table create --name modelexecutions --connection-string "$STORAGE_CONNECTION"
az storage table create --name pickshistory --connection-string "$STORAGE_CONNECTION"

# Create containers
az storage container create --name model-results --connection-string "$STORAGE_CONNECTION"
az storage container create --name picks-data --connection-string "$STORAGE_CONNECTION"
az storage container create --name picks-analysis --connection-string "$STORAGE_CONNECTION"
```

### Step 5: Deploy Monitoring

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --workspace-name gbsv-logs \
  --resource-group dashboard-gbsv-main-rg \
  --location eastus

# Create Application Insights
az monitor app-insights component create \
  --app gbsv-orchestrator-insights \
  --resource-group dashboard-gbsv-main-rg \
  --location eastus \
  --workspace gbsv-logs
```

### Step 6: Deploy SignalR

```bash
# Create SignalR service
az signalr create \
  --name gbsv-signalr \
  --resource-group dashboard-gbsv-main-rg \
  --location eastus \
  --sku Free_F1 \
  --service-mode Serverless

# Configure CORS
az signalr cors update \
  --name gbsv-signalr \
  --resource-group dashboard-gbsv-main-rg \
  --allowed-origins "https://wittypebble-41c11c65.eastus.azurestaticapps.net"
```

### Step 7: Build and Deploy Orchestrator

```bash
# Navigate to azure-functions directory
cd azure-functions

# Build Docker image
docker build -t gbsv-orchestrator:latest .

# Create container registry
az acr create \
  --name gbsvregistry \
  --resource-group dashboard-gbsv-main-rg \
  --sku Basic

# Push image to registry
az acr build \
  --registry gbsvregistry \
  --image gbsv-orchestrator:latest .

# Create Container App Environment
az containerapp env create \
  --name gbsv-aca-env \
  --resource-group dashboard-gbsv-main-rg \
  --location eastus

# Deploy Container App
az containerapp create \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --environment gbsv-aca-env \
  --image gbsvregistry.azurecr.io/gbsv-orchestrator:latest \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10
```

### Step 8: Configure RBAC

```bash
# Get managed identity
IDENTITY_ID=$(az containerapp identity show \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --query principalId -o tsv)

# Grant permissions to model resource groups
for RG in nba-gbsv-model-rg ncaam-gbsv-model-rg nfl-gbsv-model-rg ncaaf-gbsv-model-rg; do
  az role assignment create \
    --assignee $IDENTITY_ID \
    --role Contributor \
    --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/$RG"
done
```

### Step 9: Initialize Model Registry

```bash
# Get orchestrator URL
ORCHESTRATOR_URL=$(az containerapp show \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --query properties.configuration.ingress.fqdn -o tsv)

# Register each model
curl -X POST "https://$ORCHESTRATOR_URL/api/registry/update" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nba",
    "endpoint": "https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io",
    "version": "1.0.0"
  }'

# Repeat for ncaam, nfl, ncaaf
```

### Step 10: Pick Analysis Integration (Optional)

Pick-analysis tooling was removed from this repository during cleanup. If you need it, use the tracker tools under `tracker_pnl/` or restore from your external analytics repo.

## 🔍 Verification Steps

### 1. Test Health Endpoint

```bash
curl https://[orchestrator-url]/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "checks": {
    "storage": { "status": "healthy" },
    "signalr": { "status": "healthy" },
    "monitoring": { "status": "healthy" }
  }
}
```

### 2. Test Registry

```bash
curl https://[orchestrator-url]/api/registry
```

### 3. Test Model Execution

```bash
curl -X POST https://[orchestrator-url]/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"model": "nba", "params": {"date": "2024-01-06"}}'
```

### 4. Check Azure Portal

1. Navigate to Resource Group: `dashboard-gbsv-main-rg`
2. Check Container App status
3. View Application Insights metrics
4. Verify Storage tables have data

## 🔄 GitHub Secrets Configuration

Add these secrets to your GitHub repository:

| Secret Name             | Value                   | Description               |
| ----------------------- | ----------------------- | ------------------------- |
| `AZURE_CLIENT_ID`       | Service Principal ID    | For Azure authentication  |
| `AZURE_TENANT_ID`       | Azure Tenant ID         | Directory ID              |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID         | Target subscription       |
| `ACR_LOGIN_SERVER`      | gbsvregistry.azurecr.io | Container registry URL    |
| `ACR_USERNAME`          | gbsvregistry            | Registry username         |
| `ACR_PASSWORD`          | [password]              | Registry password         |
| `ORCHESTRATOR_URL`      | https://[url]/api       | Orchestrator API endpoint |

## 📊 Monitoring Setup

### Application Insights Dashboards

1. Go to Azure Portal > Application Insights
2. Create new dashboard
3. Add tiles:
   - Request rate
   - Failed requests
   - Response time
   - Dependency calls

### Alerts Configuration

```bash
# Create alert for high failure rate
az monitor metrics alert create \
  --name high-failure-rate \
  --resource-group dashboard-gbsv-main-rg \
  --scopes [app-insights-id] \
  --condition "avg requests/failed > 0.1" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Container App Not Starting

```bash
# Check logs
az containerapp logs show \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg

# Check environment variables
az containerapp show \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --query properties.template.containers[0].env
```

#### 2. Storage Connection Issues

```bash
# Verify connection string
az storage account show-connection-string \
  --name gbsvorchestratorstorage \
  --resource-group dashboard-gbsv-main-rg

# Test connectivity
az storage table list --connection-string "[connection-string]"
```

#### 3. RBAC Permission Denied

```bash
# Check role assignments
az role assignment list \
  --assignee [identity-id] \
  --all
```

#### 4. SignalR Connection Failed

```bash
# Check CORS settings
az signalr cors show \
  --name gbsv-signalr \
  --resource-group dashboard-gbsv-main-rg

# Verify connection string
az signalr key show \
  --name gbsv-signalr \
  --resource-group dashboard-gbsv-main-rg
```

## 📝 Post-Deployment Checklist

- [ ] Orchestrator health check returns 200
- [ ] Model registry contains all 4 endpoints
- [ ] SignalR CORS configured for dashboard URL
- [ ] Storage tables created and accessible
- [ ] Application Insights receiving telemetry
- [ ] Container App scaling properly
- [ ] RBAC permissions granted to all model RGs
- [ ] GitHub Actions workflow runs successfully
- [ ] Pick analysis integration tested
- [ ] Dashboard can fetch from orchestrator API

## 🔄 Update Process

### Update Orchestrator

```bash
# Build new image
docker build -t gbsv-orchestrator:v2 azure-functions/

# Push to registry
az acr build --registry gbsvregistry --image gbsv-orchestrator:v2 azure-functions/

# Update Container App
az containerapp update \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --image gbsvregistry.azurecr.io/gbsv-orchestrator:v2
```

### Update Model Endpoints

```bash
curl -X POST https://[orchestrator-url]/api/registry/update \
  -H "Content-Type: application/json" \
  -d '{"model": "nba", "endpoint": "[new-endpoint]", "version": "2.0.0"}'
```

## 🚨 Emergency Procedures

### Rollback Orchestrator

```bash
# List previous revisions
az containerapp revision list \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg

# Activate previous revision
az containerapp revision activate \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --revision [revision-name]
```

### Disable Model

```bash
# Remove from registry
curl -X DELETE https://[orchestrator-url]/api/registry/[model]
```

### Emergency Scale Down

```bash
az containerapp update \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --min-replicas 0 \
  --max-replicas 0
```

## 📞 Support

- **Email**: jb@greenbiercapital.com
- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues

## 🎉 Success Indicators

When deployment is successful, you should see:

1. ✅ All health checks passing
2. ✅ Model endpoints registered
3. ✅ Dashboard loading picks
4. ✅ Real-time updates working
5. ✅ Pick analysis uploading
6. ✅ Monitoring data flowing
7. ✅ CI/CD pipeline green

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Author**: GBSV Team

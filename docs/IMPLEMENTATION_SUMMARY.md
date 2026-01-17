# Model Integration Implementation Summary

## Overview

Successfully implemented a comprehensive model integration architecture for the GBSV Dashboard that enables:
- Dashboard-triggered model execution across Azure Resource Groups
- Real-time status updates for running models
- Automatic CI/CD integration for model updates
- Centralized orchestration with secure cross-RG authentication

## Architecture Components Implemented

### 1. Azure Functions Orchestrator (`azure-functions/`)

Created a complete Azure Functions app that serves as the central orchestration layer:

- **ModelOrchestrator** - Main HTTP trigger for accepting execution requests
- **ModelJobProcessor** - Queue-triggered processor for async model execution
- **ModelStatus** - HTTP endpoint for checking job status
- **ModelRegistry** - Tracks model versions and endpoints
- **SignalRInfo** - Provides SignalR connection negotiation

**Location**: To be deployed in `dashboard-gbsv-main-rg`

### 2. Dashboard UI Components

Dashboard-triggered model execution UI has been removed (no “Run Analysis” buttons/status panel in `dashboard.html`).

### 3. CI/CD Pipeline

Created GitHub Actions workflow (`.github/workflows/model-update-notify.yml`) that:
- Accepts model update notifications
- Updates model registry
- Invalidates caches
- Optionally triggers immediate model execution
- Sends notifications to Teams/Slack
- Creates deployment records

### 4. Deployment Scripts

Created deployment automation scripts:
- **`azure-functions/deploy.sh`** - Bash script for Linux/Mac
- **`azure-functions/deploy.ps1`** - PowerShell script for Windows
- **`azure-functions/README.md`** - Comprehensive deployment guide

## Deployment Instructions

### Step 1: Deploy Orchestrator as Container App

1. Ensure Azure and ACR creds are set as GitHub secrets (see azure-functions/README.md).
2. Push to `main` or manually run `.github/workflows/azure-functions-container.yml`.
3. Note the main domain output by the workflow (e.g., `https://www.greenbiersportventures.com`).

### Step 2: Configure SignalR Service

```bash
# Create SignalR Service
az signalr create \
  --name gbsv-signalr \
  --resource-group dashboard-gbsv-main-rg \
  --sku Free_F1 \
  --service-mode Serverless

# Get connection string and add to Function App
```

### Step 3: Setup RBAC Permissions

Grant the Function App's Managed Identity access to model resource groups:

```bash
# Get identity
IDENTITY=$(az functionapp identity show \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --query principalId -o tsv)

# Grant permissions to each model RG
az role assignment create \
  --role "Contributor" \
  --assignee $IDENTITY \
  --scope /subscriptions/YOUR_SUB_ID/resourceGroups/nba-gbsv-model-rg
```

### Step 4: Update Model Container Apps

Each model Container App needs these endpoints:
- `POST /execute` - Trigger model execution
- `GET /status/{jobId}` - Check execution status
- `GET /results/{jobId}` - Retrieve results
- `GET /version` - Return current version

### Step 5: Configure GitHub Secrets

Add these secrets to your GitHub repository:
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`
- `AZURE_FUNCTIONS_STORAGE_CONNECTION`, `AZURE_SIGNALR_CONNECTION_STRING`, `APPINSIGHTS_CONNECTION_STRING`
- `DASHBOARD_URL` - Your dashboard URL
- `NOTIFICATION_WEBHOOK_URL` - Teams/Slack webhook (optional)

### Step 6: Deploy Dashboard Updates

The dashboard code is already updated. Simply deploy to your static web app:

```bash
# Commit and push changes
git add .
git commit -m "Add model execution integration"
git push
```

## Usage

### Triggering Model Execution from Dashboard

1. Navigate to the dashboard
2. Click one of the model execution buttons (NBA, NCAAM, NFL, NCAAF)
3. Watch real-time status updates in the status display
4. Picks automatically refresh when execution completes

### Triggering via CI/CD

From GitHub Actions:
1. Go to Actions tab
2. Select "Model Update Notification"
3. Click "Run workflow"
4. Select model type and version
5. Optionally trigger immediate execution

Via API:
```bash
curl -X POST https://api.github.com/repos/YOUR_ORG/Dashboard_Home_Page/dispatches \
  -H "Authorization: token YOUR_TOKEN" \
  -d '{"event_type":"model-updated","client_payload":{"model_type":"nba","version":"2.1.0"}}'
```

## Resource Group Structure

The implementation maintains your specified RG structure:

- **`dashboard-gbsv-main-rg`**:
  - Container App (gbsv-orchestrator)
  - Container Apps Environment (gbsv-aca-env)
  - Storage Account (gbsvorchestratorstorage)
  - SignalR Service (gbsv-signalr)
  - Application Insights (gbsv-orchestrator-insights)

- **`domain_svcs_azure_green_bier`**:
  - Azure Key Vault (for secrets)
  - Private endpoints (if needed)
  - API Management (optional, for advanced scenarios)

- **Model RGs** (unchanged):
  - `nba-gbsv-model-rg`
  - `ncaaf-gbsv-model-rg`
  - `nfl-gbsv-model-rg`
  - `ncaam-gbsv-model-rg`

## Security Features

- **Managed Identity**: Cross-RG authentication without passwords
- **RBAC**: Granular permissions for resource access
- **Key Vault Integration**: Secure secret storage
- **CORS Configuration**: Restricted to your domain
- **No Direct Model Access**: All calls go through orchestrator

## Monitoring

- **Application Insights**: Full telemetry and logging
- **Live Metrics**: Real-time performance monitoring
- **Custom Dashboards**: Model execution metrics
- **Alerts**: Failure notifications

## Next Steps

1. **Deploy the Functions App** using provided scripts
2. **Configure Azure resources** (SignalR, App Insights)
3. **Grant RBAC permissions** to Managed Identity
4. **Test model execution** from dashboard
5. **Setup monitoring dashboards** in Azure Portal
6. **Configure alerts** for failures

## Troubleshooting

If model execution fails:
1. Check Function App logs in Azure Portal
2. Verify RBAC permissions are granted
3. Ensure model Container Apps are running
4. Check network connectivity between RGs
5. Review Application Insights for detailed errors

## Support

For questions or issues:
- Review `azure-functions/README.md` for detailed troubleshooting
- Check Azure Portal logs and metrics
- Contact: jb@greenbiercapital.com

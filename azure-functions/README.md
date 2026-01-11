# GBSV Model Orchestrator - Azure Functions

This Azure Functions app provides the orchestration layer for the GBSV Dashboard, enabling:
- Cross-resource group model execution
- Real-time status updates via SignalR
- Model version registry management
- Asynchronous job processing

## Architecture

The orchestrator acts as a central hub in `dashboard-gbsv-main-rg` that:
1. Accepts model execution requests from the dashboard
2. Authenticates to model Container Apps in separate RGs using Managed Identity
3. Queues jobs for async processing
4. Provides real-time status updates via SignalR
5. Stores results in Azure Storage

## Prerequisites

- Azure CLI installed and logged in
- Node.js 18+ installed
- Azure subscription with appropriate permissions
- Resource groups already created:
  - `dashboard-gbsv-main-rg` (for this Functions app)
  - Model RGs: `nba-gbsv-model-rg`, `nfl-gbsv-model-rg`, etc.

## Deployment

### Option A: Container App (recommended)

Deploy the Functions backend as a container via Azure Container Apps using the GitHub Actions workflow:

1. Set GitHub secrets:
  - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
  - `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`
  - `AZURE_FUNCTIONS_STORAGE_CONNECTION`, `AZURE_SIGNALR_CONNECTION_STRING`, `APPINSIGHTS_CONNECTION_STRING`
2. Push to `main` or run `.github/workflows/azure-functions-container.yml` manually.
3. After deploy, grab the Container App FQDN (workflow outputs it) and set `API_BASE_URL` in `client/config.js` to `https://<fqdn>/api`.

### Option B: Zip deploy (legacy)

#### Windows (PowerShell):
```powershell
.\deploy.ps1
```

#### Linux/Mac (Bash):
```bash
chmod +x deploy.sh
./deploy.sh
```

Manual zip deploy steps remain the same:

1. **Install dependencies:**
  ```bash
  npm install
  ```

2. **Create Azure resources:**
  ```bash
  # Create Function App
  az functionapp create \
    --resource-group dashboard-gbsv-main-rg \
    --consumption-plan-location eastus \
    --runtime node \
    --runtime-version 18 \
    --functions-version 4 \
    --name gbsv-orchestrator \
    --storage-account gbsvorchestratorstorage

  # Enable Managed Identity
  az functionapp identity assign \
    --name gbsv-orchestrator \
    --resource-group dashboard-gbsv-main-rg
  ```

3. **Deploy the code:**
  ```bash
  func azure functionapp publish gbsv-orchestrator
  ```

## Post-Deployment Configuration

### 1. SignalR Service Setup

The deploy scripts now create (or reconcile) the `gbsv-signalr` service in `dashboard-gbsv-main-rg` with SKU `Free_F1` and `Serverless` mode, and they push the resulting connection string into the function app settings automatically. If you need to reconfigure the SignalR resource manually (for key rotation or a custom service name), edit the `SIGNALR_SERVICE_NAME` value at the top of `deploy.ps1` / `deploy.sh` and rerun the script. The commands below can be used for manual verification or troubleshooting:

```bash
az signalr show \
  --name gbsv-signalr \
  --resource-group dashboard-gbsv-main-rg
```

```bash
az signalr key list \
  --name gbsv-signalr \
  --resource-group dashboard-gbsv-main-rg \
  --query primaryConnectionString -o tsv
```

```bash
az functionapp config appsettings list \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --query "[?name=='AzureSignalRConnectionString']"
```

### 2. Grant RBAC Permissions

Get the Managed Identity principal ID:
```bash
IDENTITY=$(az functionapp identity show \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --query principalId -o tsv)
```

Grant permissions to each model RG:
```bash
# For NBA model
az role assignment create \
  --role "Contributor" \
  --assignee $IDENTITY \
  --scope /subscriptions/<SUB_ID>/resourceGroups/nba-gbsv-model-rg

# Repeat for NFL, NCAAM, NCAAF
```

### 3. Configure Application Insights

```bash
az monitor app-insights component create \
  --app gbsv-orchestrator-insights \
  --location eastus \
  --resource-group dashboard-gbsv-main-rg

# Get the connection string
INSIGHTS_CONNECTION=$(az monitor app-insights component show \
  --app gbsv-orchestrator-insights \
  --resource-group dashboard-gbsv-main-rg \
  --query connectionString -o tsv)

# Add to Function App
az functionapp config appsettings set \
  --name gbsv-orchestrator \
  --resource-group dashboard-gbsv-main-rg \
  --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$INSIGHTS_CONNECTION"
```

### 4. Update Dashboard Configuration

Update `client/config.js` in the dashboard:

```javascript
ORCHESTRATOR_URL: 'https://gbsv-orchestrator.azurewebsites.net/api',
SIGNALR_HUB_URL: 'https://gbsv-signalr.service.signalr.net',
```

## API Endpoints

### Execute Model
```
POST /api/execute
{
  "model": "nba|nfl|ncaam|ncaaf",
  "params": {
    "date": "today|tomorrow|YYYY-MM-DD",
    ...
  }
}
```

### Model-Specific Endpoints Called by JobProcessor
Each model type calls its Container App with sport-specific endpoints:

| Model | Endpoint Pattern | Example |
|-------|------------------|---------|
| NBA   | `/slate/{date}/executive` | `/slate/today/executive` |
| NCAAM | `/api/picks/{date}` | `/api/picks/2026-01-03` |
| NFL   | `/api/v1/predictions/week/{season}/{week}` | `/api/v1/predictions/week/2025/18` |
| NCAAF | `/api/v1/predictions/week/{season}/{week}` | `/api/v1/predictions/week/2025/15` |

These endpoints match the frontend fetchers (`nba-picks-fetcher.js`, etc.) for consistency.

### Check Status
```
GET /api/status/{jobId}
```

### Get Model Registry
```
GET /api/registry
```

### Update Registry
```
POST /api/registry/update
{
  "model": "nba",
  "version": "2.1.0"
}
```

### SignalR Negotiation
```
POST /api/signalr/negotiate
```

## Local Development

1. Install Azure Functions Core Tools:
   ```bash
   npm install -g azure-functions-core-tools@4
   ```

2. Copy `local.settings.json.example` to `local.settings.json` and fill in values

3. Start the function app locally:
   ```bash
   func start
   ```

4. Use ngrok for testing SignalR locally:
   ```bash
   ngrok http 7071
   ```

## Monitoring

View logs and metrics in Azure Portal:
1. Go to Function App > Functions > Select a function
2. View "Monitor" tab for execution history
3. View "Live Metrics" for real-time monitoring
4. Check Application Insights for detailed telemetry

## Troubleshooting

### Function not triggering
- Check if queue messages are being created in Storage Account
- Verify connection strings in App Settings
- Check Function App logs for errors

### SignalR connection failing
- Verify SignalR connection string is set
- Check CORS settings include your domain
- Ensure SignalR Service is in Serverless mode

### Model API calls failing
- Verify Managed Identity has proper RBAC permissions
- Check model Container Apps are running
- Verify network connectivity between RGs

### Storage errors
- Ensure storage containers/tables/queues exist
- Check storage account connection string
- Verify storage account firewall rules

## Security Considerations

- All model APIs should validate Managed Identity tokens
- Use Azure Key Vault for sensitive configuration
- Enable network restrictions on Function App
- Implement rate limiting for API calls
- Use Application Gateway or Front Door for additional security

## Cost Optimization

- Use Consumption plan for Functions (pay per execution)
- Use Free tier for SignalR if traffic is low
- Enable auto-scaling for Container Apps
- Set up cost alerts in Azure Cost Management
- Archive old job results to cool storage tier

## Support

For issues or questions:
- Check Function App logs in Azure Portal
- Review Application Insights for detailed errors
- Contact: jb@greenbiercapital.com

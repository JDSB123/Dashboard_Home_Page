#!/bin/bash
# scripts/setup-azure-ops.sh
# Automates Azure cost alerts and enables diagnostic logging for key resources.

set -e

RESOURCE_GROUP="dashboard-gbsv-main-rg"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
BUDGET_NAME="MonthlyBudget"
BUDGET_AMOUNT=100
EMAIL_ADDRESS="admin@greenbiersportventures.com"

echo "Setting up budget alert for $BUDGET_AMOUNT USD..."

az consumption budget create \
  --amount $BUDGET_AMOUNT \
  --budget-name $BUDGET_NAME \
  --category Cost \
  --time-grain Monthly \
  --start-date $(date +%Y-%m-01) \
  --end-date $(date -d "+10 years" +%Y-%m-%d) \
  --contact-emails $EMAIL_ADDRESS \
  --notification-threshold 80 90 100

echo "Enabling diagnostic logging for key resources..."

# 1. Cosmos DB
COSMOS_ID=$(az resource show -g $RESOURCE_GROUP -n "gbsv-picks-db" --resource-type "Microsoft.DocumentDB/databaseAccounts" --query id -o tsv)
WORKSPACE_ID=$(az monitor log-analytics workspace show -g $RESOURCE_GROUP -n "gbsv-logs" --query id -o tsv 2>/dev/null || echo "")

if [ -n "$WORKSPACE_ID" ]; then
    echo "Configuring Cosmos DB diagnostics..."
    az monitor diagnostic-settings create \
      --name "cosmos-to-la" \
      --resource $COSMOS_ID \
      --workspace $WORKSPACE_ID \
      --logs '[{"category": "DataPlaneRequests", "enabled": true}, {"category": "QueryRuntimeStatistics", "enabled": true}]' \
      --metrics '[{"category": "Requests", "enabled": true}]'
fi

# 2. Function App
ORCH_ID=$(az resource show -g $RESOURCE_GROUP -n "gbsv-orchestrator" --resource-type "Microsoft.Web/sites" --query id -o tsv)
if [ -n "$WORKSPACE_ID" ]; then
    echo "Configuring Orchestrator diagnostics..."
    az monitor diagnostic-settings create \
      --name "orch-to-la" \
      --resource $ORCH_ID \
      --workspace $WORKSPACE_ID \
      --logs '[{"category": "FunctionAppLogs", "enabled": true}]' \
      --metrics '[{"category": "AllMetrics", "enabled": true}]'
fi

echo "Azure Ops setup complete."

#!/bin/bash

# Azure Functions Deployment Script
# Deploy the GBSV Model Orchestrator to Azure

set -e

# Configuration
RESOURCE_GROUP="dashboard-gbsv-main-rg"
FUNCTION_APP_NAME="gbsv-orchestrator"
STORAGE_ACCOUNT="gbsvorchestratorstorage"
LOCATION="eastus"
RUNTIME="node"
RUNTIME_VERSION="18"
SIGNALR_SERVICE_NAME="gbsv-signalr"
SIGNALR_SKU="Free_F1"
SIGNALR_MODE="Serverless"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment of GBSV Model Orchestrator${NC}"

# Check if logged in to Azure
echo "Checking Azure login status..."
if ! az account show &>/dev/null; then
    echo -e "${RED}Not logged in to Azure. Please run 'az login' first.${NC}"
    exit 1
fi

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}Using subscription: $SUBSCRIPTION${NC}"

# Check if resource group exists
echo "Checking resource group..."
if ! az group show --name $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}Resource group $RESOURCE_GROUP does not exist. Creating...${NC}"
    az group create --name $RESOURCE_GROUP --location $LOCATION
else
    echo -e "${GREEN}Resource group $RESOURCE_GROUP exists${NC}"
fi

# Check if storage account exists
echo "Checking storage account..."
if ! az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}Creating storage account $STORAGE_ACCOUNT...${NC}"
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --location $LOCATION \
        --resource-group $RESOURCE_GROUP \
        --sku Standard_LRS \
        --kind StorageV2
else
    echo -e "${GREEN}Storage account $STORAGE_ACCOUNT exists${NC}"
fi

# Get storage connection string
echo "Getting storage connection string..."
STORAGE_CONNECTION=$(az storage account show-connection-string \
    --resource-group $RESOURCE_GROUP \
    --name $STORAGE_ACCOUNT \
    --query connectionString -o tsv)

# Create required storage containers
echo "Creating storage containers..."
az storage container create --name model-results --connection-string "$STORAGE_CONNECTION" 2>/dev/null || true
az storage queue create --name model-jobs --connection-string "$STORAGE_CONNECTION" 2>/dev/null || true
az storage table create --name modelexecutions --connection-string "$STORAGE_CONNECTION" 2>/dev/null || true
az storage table create --name modelregistry --connection-string "$STORAGE_CONNECTION" 2>/dev/null || true

# Check if function app exists
echo "Checking function app..."
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}Creating function app $FUNCTION_APP_NAME...${NC}"
    az functionapp create \
        --resource-group $RESOURCE_GROUP \
        --consumption-plan-location $LOCATION \
        --runtime $RUNTIME \
        --runtime-version $RUNTIME_VERSION \
        --functions-version 4 \
        --name $FUNCTION_APP_NAME \
        --storage-account $STORAGE_ACCOUNT \
        --os-type Linux
else
    echo -e "${GREEN}Function app $FUNCTION_APP_NAME exists${NC}"
fi

# Enable managed identity
echo "Enabling managed identity..."
IDENTITY=$(az functionapp identity assign \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query principalId -o tsv)

echo -e "${GREEN}Managed Identity Principal ID: $IDENTITY${NC}"

# Ensure SignalR service exists and is configured
echo "Ensuring SignalR service '$SIGNALR_SERVICE_NAME' exists..."
SIGNALR_EXISTS=$(az signalr show \
    --name $SIGNALR_SERVICE_NAME \
    --resource-group $RESOURCE_GROUP \
    --query name -o tsv 2>/dev/null || true)

if [ -z "$SIGNALR_EXISTS" ]; then
    echo "Creating SignalR service..."
    az signalr create \
        --name $SIGNALR_SERVICE_NAME \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku $SIGNALR_SKU \
        --service-mode $SIGNALR_MODE
else
    CURRENT_MODE=$(az signalr show \
        --name $SIGNALR_SERVICE_NAME \
        --resource-group $RESOURCE_GROUP \
        --query serviceMode -o tsv)
    CURRENT_SKU=$(az signalr show \
        --name $SIGNALR_SERVICE_NAME \
        --resource-group $RESOURCE_GROUP \
        --query sku.name -o tsv)

    if [ "$CURRENT_MODE" != "$SIGNALR_MODE" ] || [ "$CURRENT_SKU" != "$SIGNALR_SKU" ]; then
        echo "Updating SignalR service configuration..."
        az signalr update \
            --name $SIGNALR_SERVICE_NAME \
            --resource-group $RESOURCE_GROUP \
            --sku $SIGNALR_SKU \
            --service-mode $SIGNALR_MODE
    fi
fi

echo "Retrieving SignalR connection string..."
SIGNALR_CONNECTION=$(az signalr key list \
    --name $SIGNALR_SERVICE_NAME \
    --resource-group $RESOURCE_GROUP \
    --query primaryConnectionString -o tsv)

if [ -z "$SIGNALR_CONNECTION" ]; then
    echo -e "${RED}Failed to read SignalR connection string. Aborting.${NC}"
    exit 1
fi

# Configure application settings
echo "Configuring application settings..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
    "AzureWebJobsStorage=$STORAGE_CONNECTION" \
    "AzureSignalRConnectionString=$SIGNALR_CONNECTION" \
    "WEBSITE_RUN_FROM_PACKAGE=1" \
    "FUNCTIONS_WORKER_RUNTIME=node" \
    "NBA_API_URL=https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io" \
    "NCAAM_API_URL=https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io" \
    "NFL_API_URL=https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io" \
    "NCAAF_API_URL=https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io"

# Enable CORS
echo "Configuring CORS..."
az functionapp cors add \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "https://www.greenbiersportventures.com" "http://localhost:8080"

# Install npm dependencies
echo "Installing dependencies..."
npm install

# Create deployment package
echo "Creating deployment package..."
zip -r deployment.zip . -x "*.git*" -x "node_modules/*" -x "local.settings.json" -x "deploy.sh" -x "*.md"

# Deploy to Azure
echo "Deploying to Azure..."
az functionapp deployment source config-zip \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --src deployment.zip

# Clean up
rm deployment.zip

# Get function app URL
FUNCTION_URL=$(az functionapp show \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query defaultHostName -o tsv)

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}Function App URL: https://$FUNCTION_URL${NC}"
echo -e "${GREEN}Orchestrator API: https://$FUNCTION_URL/api${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Grant RBAC permissions to the managed identity for accessing model Container Apps"
echo "2. Update dashboard config with the orchestrator URL"
echo "3. (Optional) Verify the AzureSignalRConnectionString app setting if you customized the SignalR service"
echo ""
echo -e "${YELLOW}To grant RBAC permissions, run:${NC}"
echo "az role assignment create --role \"Container Apps Reader\" --assignee $IDENTITY --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/nba-gbsv-model-rg"
echo "az role assignment create --role \"Container Apps Reader\" --assignee $IDENTITY --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/nfl-gbsv-model-rg"
echo "az role assignment create --role \"Container Apps Reader\" --assignee $IDENTITY --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/ncaam-gbsv-model-rg"
echo "az role assignment create --role \"Container Apps Reader\" --assignee $IDENTITY --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/ncaaf-gbsv-model-rg"

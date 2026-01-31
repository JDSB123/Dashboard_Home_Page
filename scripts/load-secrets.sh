#!/bin/bash
# scripts/load-secrets.sh
# Load API secrets from Azure Key Vault into the environment for local development.

set -e

# Default Resource Group and Vault name (fallback)
RG_NAME="${AZURE_RESOURCE_GROUP:-dashboard-gbsv-main-rg}"
VAULT_NAME=$(az keyvault list --resource-group "$RG_NAME" --query "[0].name" -o tsv 2>/dev/null || echo "dashboard-gbsv-kv-prod")

printf "\n🔐 Loading API secrets from Key Vault: %s...\n" "$VAULT_NAME"

# Check if logged in
if ! az account show &>/dev/null; then
    printf "  ❌ Not logged into Azure. Run: az login\n"
    exit 0 # Don't fail the whole script, just skip KV
fi

# List of secrets to fetch and their environment variable names
# Map: "Secret Name" -> "Env Var Name"
declare -A SECRET_MAP=(
    ["sportsdataio-nfl-ncaaf"]="SDIO_KEY"
    ["oddsapi-main"]="ODDS_API_KEY"
    ["basketball-api"]="BASKETBALL_API_KEY"
    ["actionnetwork-user"]="ACTIONNETWORK_USER"
    ["actionnetwork-password"]="ACTIONNETWORK_PASS"
    ["telegram-bot-token"]="TELEGRAM_BOT_TOKEN"
)

# Fetch each secret from Key Vault
for SECRET_NAME in "${!SECRET_MAP[@]}"; do
    ENV_VAR="${SECRET_MAP[$SECRET_NAME]}"
    printf "  Fetching %s from Key Vault..." "$SECRET_NAME"
    
    VALUE=$(az keyvault secret show --vault-name "$VAULT_NAME" --name "$SECRET_NAME" --query value -o tsv 2>/dev/null || echo "")
    
    if [ -n "$VALUE" ]; then
        export "$ENV_VAR"="$VALUE"
        printf " ✅\n"
    else
        printf " ⚠️ Not found in KV\n"
    fi
done

# Fallback/Direct Resource Fetch for Core Infrastructure
printf "\n🏗️ Refreshing Infrastructure Credentials...\n"

# 1. Cosmos DB
printf "  Syncing Cosmos DB (gbsv-picks-db)..."
COSMOS_ENDPOINT="https://gbsv-picks-db.documents.azure.com:443/"
COSMOS_KEY=$(az cosmosdb keys list --resource-group "$RG_NAME" --name "gbsv-picks-db" --query primaryMasterKey -o tsv 2>/dev/null || echo "")
if [ -n "$COSMOS_KEY" ]; then
    export COSMOS_ENDPOINT="$COSMOS_ENDPOINT"
    export COSMOS_KEY="$COSMOS_KEY"
    export COSMOS_CONNECTION_STRING="AccountEndpoint=$COSMOS_ENDPOINT;AccountKey=$COSMOS_KEY;"
    printf " ✅\n"
else
    printf " ⚠️ Failed\n"
fi

# 2. Storage
printf "  Syncing Storage (gbsvorchestratorstorage)..."
STORAGE_CONN=$(az storage account show-connection-string --resource-group "$RG_NAME" --name "gbsvorchestratorstorage" --query connectionString -o tsv 2>/dev/null || echo "")
if [ -n "$STORAGE_CONN" ]; then
    export AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONN"
    export AzureWebJobsStorage="$STORAGE_CONN"
    printf " ✅\n"
else
    printf " ⚠️ Failed\n"
fi

# Update .env file for persistence in the workspace
if [ -f ".env" ]; then
    printf "\n💾 Updating .env file..."
    # Create temp file to avoid partial updates
    TMP_ENV=$(mktemp)
    cp .env "$TMP_ENV"
    
    for VAR in SDIO_KEY ODDS_API_KEY BASKETBALL_API_KEY ACTIONNETWORK_USER ACTIONNETWORK_PASS TELEGRAM_BOT_TOKEN COSMOS_ENDPOINT COSMOS_KEY COSMOS_CONNECTION_STRING AZURE_STORAGE_CONNECTION_STRING AzureWebJobsStorage; do
        VAL="${!VAR:-}"
        if [ -n "$VAL" ]; then
            sed -i "/^export $VAR=/d" "$TMP_ENV"
            sed -i "/^$VAR=/d" "$TMP_ENV"
            echo "export $VAR=\"$VAL\"" >> "$TMP_ENV"
        fi
    done
    cat "$TMP_ENV" > .env
    rm "$TMP_ENV"
    printf " ✅\n"
fi

printf "\n✨ Workspace synchronized with Single Source of Truth (Key Vault & Resources).\n"

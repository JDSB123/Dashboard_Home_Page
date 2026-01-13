#!/bin/bash
# Upload team logos to Azure Blob Storage using Azure CLI
# Run this script after downloading logos

STORAGE_ACCOUNT="gbsvorchestratorstorage"
CONTAINER="team-logos"
RESOURCE_GROUP="dashboard-gbsv-main-rg"
LOGO_DIR="./team-logos"

echo "📤 Uploading team logos to Azure Blob Storage..."
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Container: $CONTAINER"
echo ""

# Create container if it doesn't exist
az storage container create \
  --name $CONTAINER \
  --account-name $STORAGE_ACCOUNT \
  --auth-mode login \
  --public-access blob \
  2>/dev/null || true

# Upload all PNG files
if [ -d "$LOGO_DIR" ]; then
  echo "📁 Uploading from: $LOGO_DIR"
  for file in $LOGO_DIR/*.png; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      echo "  📤 $filename"
      az storage blob upload \
        --file "$file" \
        --container-name $CONTAINER \
        --name "$filename" \
        --account-name $STORAGE_ACCOUNT \
        --auth-mode login \
        --overwrite
    fi
  done
  echo "✅ Upload complete!"
else
  echo "❌ Directory not found: $LOGO_DIR"
  echo "Download logos first using the PowerShell script"
fi

# Get CDN endpoint
echo ""
echo "📍 Azure Storage URLs:"
echo "  https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER/{filename}"

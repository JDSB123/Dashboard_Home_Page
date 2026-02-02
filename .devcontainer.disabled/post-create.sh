#!/bin/bash
# Post-create script for dashboard-gbsv-dev-codespace
set -e

echo "🚀 Setting up dashboard-gbsv-dev-codespace..."

# Install Azure Functions dependencies
echo "📦 Installing Azure Functions dependencies..."
cd /workspaces/Dashboard_Home_Page/azure-functions
npm install

# Install Python dependencies if requirements.txt exists
if [ -f "/workspaces/Dashboard_Home_Page/requirements.txt" ]; then
    echo "🐍 Installing Python dependencies..."
    pip3 install -r /workspaces/Dashboard_Home_Page/requirements.txt
fi

# Install data-pipeline Python dependencies
if [ -f "/workspaces/Dashboard_Home_Page/data-pipeline/requirements.txt" ]; then
    echo "🐍 Installing data-pipeline Python dependencies..."
    pip3 install -r /workspaces/Dashboard_Home_Page/data-pipeline/requirements.txt
fi

# Create local.settings.json for Azure Functions if it doesn't exist
if [ ! -f "/workspaces/Dashboard_Home_Page/azure-functions/local.settings.json" ]; then
    echo "⚙️ Creating Azure Functions local.settings.json..."
    cat > /workspaces/Dashboard_Home_Page/azure-functions/local.settings.json << 'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "FUNCTIONS_EXTENSION_VERSION": "~4"
  },
  "Host": {
    "CORS": "*",
    "CORSCredentials": false
  }
}
EOF
fi

# Create client config.js from template if it doesn't exist
if [ ! -f "/workspaces/Dashboard_Home_Page/client/config.js" ] && [ -f "/workspaces/Dashboard_Home_Page/client/config.template.js" ]; then
    echo "⚙️ Creating client config.js from template..."
    cp /workspaces/Dashboard_Home_Page/client/config.template.js /workspaces/Dashboard_Home_Page/client/config.js
fi

# Ensure Azurite storage directory exists
mkdir -p /workspaces/Dashboard_Home_Page/AzuriteConfig

# Return to workspace root
cd /workspaces/Dashboard_Home_Page

echo ""
echo "✅ dashboard-gbsv-dev-codespace setup complete!"
echo ""
echo "📋 Quick Start Commands:"
echo "  • Start Azure Functions:  cd azure-functions && func host start"
echo "  • Start Azurite:          azurite --location ./AzuriteConfig"
echo "  • Start Live Server:      live-server client"
echo "  • Run VS Code Task:       Ctrl+Shift+P → Tasks: Run Task → func: host start"
echo ""

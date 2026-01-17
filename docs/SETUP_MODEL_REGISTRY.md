# Model Registry Setup Guide

This guide walks you through connecting all your model RGs to the dashboard so they update automatically.

## What This Does

When you deploy a new model version to **any** RG (nba/ncaaf/ncaam/nfl), the dashboard **automatically picks up the new URL** without redeploying.

---

## Step 1: Run the Setup Script

Open PowerShell **as Administrator** in your repo folder and run:

```powershell
cd c:\Users\JB\green-bier-ventures\DASHBOARD_main
.\setup-model-registry.ps1
```

**What it does:**

- Logs into Azure
- Creates the `modelregistry` table in your storage account
- Adds your current model endpoints (from `config.production.js`)

---

## Step 2: Verify It Worked

After the script runs, you should see:

```
✅ modelregistry table created
✅ NBA endpoint added: https://nba-gbsv-api...
✅ NCAAM endpoint added: https://ncaam-stable-prediction...
✅ NFL endpoint added: https://nfl-api...
✅ NCAAF endpoint added: https://ncaaf-v5-prod...
```

---

## Step 3: Push Dashboard Updates

The code changes are ready. Just commit and push:

```powershell
git add -A
git commit -m "feat: add model registry for perpetual endpoint sync"
git push origin main
```

This deploys:

- The orchestrator's registry resolver
- The bootstrap script that hydrates endpoints on page load

---

## Optional: Central Sync Workflow (multiple RGs)

If your models live in different resource groups, enable the included GitHub Action to keep the registry updated without touching each model repo:

- Workflow: `.github/workflows/sync-model-registry.yml`
- Script it runs: `scripts/sync-model-registry.ps1` (pulls Container App FQDNs per model RG and calls `/registry/update`)
- Required secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ORCHESTRATOR_FUNCTIONS_KEY` (Functions host key if the endpoint is secured)
- Configure `MODELS_JSON` in the workflow env to match your RG/app names for each model
- It is scheduled daily and can be run on-demand via the Actions tab

---

## Step 4: Update Your **Model** Repositories (Optional But Important)

Each of your model repos (nba-gbsv-model, ncaam-gbsv-model, etc.) should **automatically notify the dashboard** when they deploy.

### For Each Model Repo

1. Go to that repo's GitHub Secrets settings
2. Add these 3 secrets (if not already there):

- `ORCHESTRATOR_URL` = `https://www.greenbiersportventures.com/api`
- `ORCHESTRATOR_KEY` = _(ask your team or check Azure Portal → Container App → Auth)_
- `AZURE_SUBSCRIPTION_ID` = _(your subscription ID)_

3. Add this **workflow file** to that repo:

**`.github/workflows/notify-dashboard-on-deploy.yml`:**

```yaml
name: Notify Dashboard on Model Deploy

on:
  push:
    branches: [main, dev]
    paths:
      - "src/**" # Adjust to your actual model code paths
      - "requirements.txt"
      - ".github/workflows/notify-dashboard-on-deploy.yml"

jobs:
  notify:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Get Model Container App FQDN
        id: get-fqdn
        run: |
          # Replace with your actual RG and app name
          RG_NAME="nba-gbsv-model-rg"
          APP_NAME="nba-gbsv-api"

          FQDN=$(az containerapp show \
            --name "$APP_NAME" \
            --resource-group "$RG_NAME" \
            --query 'properties.configuration.ingress.fqdn' \
            --output tsv)

          if [ -z "$FQDN" ]; then
            echo "❌ Failed to get FQDN"
            exit 1
          fi

          echo "fqdn=$FQDN" >> $GITHUB_OUTPUT
          echo "✅ Got FQDN: $FQDN"

      - name: Update Dashboard Registry
        run: |
          MODEL_NAME="nba"
          NEW_FQDN="https://${{ steps.get-fqdn.outputs.fqdn }}"

          curl -X POST \
            "${{ secrets.ORCHESTRATOR_URL }}/registry/update" \
            -H "Content-Type: application/json" \
            -d '{
              "model": "'$MODEL_NAME'",
              "endpoint": "'$NEW_FQDN'",
              "version": "'$GITHUB_SHA'",
              "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
            }' \
            -w "\nHTTP Status: %{http_code}\n"
```

**Replace these for each model:**

- `nba-gbsv-model-rg` → your RG name
- `nba-gbsv-api` → your container app name
- `"nba"` → your model type (`ncaam`, `nfl`, `ncaaf`)

---

## How It Works (Behind The Scenes)

```
┌─────────────────────────────────────────────────────────────┐
│ You push code to nba-gbsv-model repo                         │
├─────────────────────────────────────────────────────────────┤
│ ↓ GitHub Action runs                                         │
│ ↓ Gets new Container App FQDN                               │
│ ↓ Calls POST /registry/update on orchestrator               │
│ ↓ Writes to modelregistry table                             │
├─────────────────────────────────────────────────────────────┤
│ User opens weekly-lineup.html                                │
│ ↓ model-endpoints-bootstrap.js runs                          │
│ ↓ Fetches /registry from orchestrator                       │
│ ↓ Hydrates APP_CONFIG with latest endpoints                │
│ ↓ NBA/NCAAM/NFL/NCAAF fetchers use new URLs                 │
├─────────────────────────────────────────────────────────────┤
│ ✅ Dashboard automatically uses new model URLs               │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

**"Setup script fails with Azure login?"**

- Make sure you have Azure CLI installed: `az --version`
- Run `az login` first to authenticate

**"modelregistry table not found"**

- The script creates it automatically. If it fails, run the script again.

**"Dashboard still using old endpoint?"**

- Check your browser's network tab (F12) → look for `/registry` request
- Make sure the orchestrator function is deployed
- Hard refresh the page (Ctrl+Shift+R)

**"How do I know the registry updated?"**

- Check Azure Portal → Storage Account → Tables → `modelregistry`
- You should see 4 rows (nba, ncaam, nfl, ncaaf) with recent timestamps

---

## Done! ✅

Your dashboard is now **perpetually linked** to all model RGs. Push from your model repos and the dashboard auto-syncs.

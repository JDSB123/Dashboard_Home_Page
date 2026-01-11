# Secrets and Credentials Tracker

## Purpose
This document lists the environment variables that must be populated from Azure Key Vault (or another secure store) before running the data pipelines and Azure Functions. Do **not** commit raw secrets to source control—always keep them in Key Vault and reference them through environment variables or `local.settings.json` references.

| Env Var | Secret Reference (Key Vault) | Notes |
|---------|-----------------------------|-------|
| `SDIO_KEY` | `sportsdataio-nfl-ncaaf` | SportsDataIO NFL/NCAAF key (used by `fetch_completed_boxes.py` and related pipeline scripts). ⚠️ Required for NFL/NCAAF schedules and box scores. |
| `ODDS_API_KEY` | `oddsapi-main` | Odds API key for NBA/NCAAM odds pulls that will be added to the pipeline. |
| `ACTIONNETWORK_USER` | `actionnetwork-user` | Email for Action Network integrations. |
| `ACTIONNETWORK_PASS` | `actionnetwork-password` | Secure password (store as secure string). |
| `BASKETBALL_API_KEY` | `basketball-api` | NBA-specific service key. |

## Quick-Load Script (PowerShell)

Run this before executing any data-pipeline script:

```powershell
# Option A – Load from .env file (local development)
# First create .env from env.template: copy env.template .env
# Then edit .env with your actual values
. .\scripts\load-secrets.ps1

# Option B – Pull from Azure Key Vault (production-ready, recommended)
. .\scripts\load-secrets.ps1 -FromKeyVault -VaultName "dashboard-gbsv-kv"
```

## Strategy
1. **Store secrets in Key Vault** if not already present. Use the names above (or your chosen aliases) so the pipelines can resolve them consistently.
2. **Map secrets to env vars** before running `fetch_completed_boxes.py`, the pick tracker, or any Azure Function. Examples:
   ```powershell
   $vault = 'dashboard-gbsv-kv'
   $env:SDIO_KEY = (az keyvault secret show --vault-name $vault --name sportsdataio-nfl-ncaaf --query value -o tsv)
   $env:ODDS_API_KEY = (az keyvault secret show --vault-name $vault --name oddsapi-main --query value -o tsv)
   ```
3. **Local development**: Create a `.env` file from `env.template` and fill in your values. This file is gitignored.
4. **Azure Functions**: Configure app settings in Azure Portal or via deployment scripts to reference Key Vault secrets.
5. **Audit**: if a fetch fails due to missing keys, the log now reports which env var was absent. Add that var back to the Key Vault / environment and rerun.

## Setting Up Key Vault Secrets

```powershell
# Login to Azure
az login

# Set the Key Vault name
$vault = 'dashboard-gbsv-kv'

# Add secrets (replace YOUR_KEY_HERE with actual values)
az keyvault secret set --vault-name $vault --name "sportsdataio-nfl-ncaaf" --value "YOUR_KEY_HERE"
az keyvault secret set --vault-name $vault --name "oddsapi-main" --value "YOUR_KEY_HERE"
az keyvault secret set --vault-name $vault --name "basketball-api" --value "YOUR_KEY_HERE"
az keyvault secret set --vault-name $vault --name "actionnetwork-user" --value "YOUR_EMAIL_HERE"
az keyvault secret set --vault-name $vault --name "actionnetwork-password" --value "YOUR_PASSWORD_HERE"
```

## Data Pipeline Output

After running `fetch_completed_boxes.py`, data is stored at:

```
data-pipeline/output/box_scores/
├── NBA/
│   ├── 2025-10-22.json   # per-day files
│   ├── ...
│   └── historical_20251001_to_20260108.json  # 628 games
├── NCAAM/
│   └── historical_20251001_to_20260108.json  # 3,137 games
├── NFL/
│   └── historical_20251001_to_20260108.json  # 208 games
└── NCAAF/
    └── historical_20251001_to_20260108.json  # 538 games
```

By keeping all credentials in Key Vault and referencing them via the env vars above, the pipelines stay secure and resilient even when switching machines.
# Secrets and Credentials Tracker

## Purpose
This document lists the environment variables that must be populated from Azure Key Vault (or another secure store) before running the data pipelines and Azure Functions. Do **not** commit raw secrets to source control—always keep them in Key Vault and reference them through environment variables or `local.settings.json` references.

| Env Var | Secret Reference (Key Vault) | Notes |
|---------|-----------------------------|-------|
| `SDIO_KEY` | `sportsdataio-nfl-ncaaf` | SportsDataIO NFL/NCAAF key (used by `fetch_completed_boxes.py` and related pipeline scripts). ⚠️ Required for NFL/NCAAF schedules and box scores. |
| `ODDS_API_KEY` | `oddsapi-main` | Odds API key for NBA/NCAAM odds pulls that will be added to the pipeline. |
| `ACTIONNETWORK_USER` | `actionnetwork-user` | `jb@greenbiercapital.com` (used for Action Network integrations). |
| `ACTIONNETWORK_PASS` | `actionnetwork-password` | Secure password (store as secure string). |
| `BASKETBALL_API_KEY` | `basketball-api` | NBA-specific service key. |

## Quick-Load Script (PowerShell)

Run this before executing any data-pipeline script:

```powershell
# Option A – Direct values (DEV ONLY; do not commit to git)
$env:SDIO_KEY = "f202ae3458724f8b9beb8230820db7fe"
$env:ODDS_API_KEY = "4a0b80471d1ebeeb74c358fa0fcc4a27"
$env:BASKETBALL_API_KEY = "eea8757fae3c507add2df14800bae25f"
$env:ACTIONNETWORK_USER = "jb@greenbiercapital.com"
$env:ACTIONNETWORK_PASS = "YOUR_PASSWORD_HERE"

# Option B – Pull from Azure Key Vault (production-ready)
$vault = 'ncaam-stablegbsvkv'
$env:SDIO_KEY = (az keyvault secret show --vault-name $vault --name sportsdataio-nfl-ncaaf --query value -o tsv)
$env:ODDS_API_KEY = (az keyvault secret show --vault-name $vault --name oddsapi-main --query value -o tsv)
$env:BASKETBALL_API_KEY = (az keyvault secret show --vault-name $vault --name basketball-api --query value -o tsv)
```

## Strategy
1. **Store secrets in Key Vault** if not already present. Use the names above (or your chosen aliases) so the pipelines can resolve them consistently.
2. **Map secrets to env vars** before running `fetch_completed_boxes.py`, the pick tracker, or any Azure Function. Examples:
   ```powershell
   $vault = 'ncaam-stablegbsvkv'
   $env:SDIO_KEY = (az keyvault secret show --vault-name $vault --name sportsdataio-nfl-ncaaf --query value -o tsv)
   $env:ODDS_API_KEY = (az keyvault secret show --vault-name $vault --name oddsapi-main --query value -o tsv)
   ```
3. **Local development**: add the same env vars to `local.settings.json` (under `Values`) or export them in your shell/profile before running scripts.
4. **Audit**: if a fetch fails due to missing keys, the log now reports which env var was absent. Add that var back to the Key Vault / environment and rerun.

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
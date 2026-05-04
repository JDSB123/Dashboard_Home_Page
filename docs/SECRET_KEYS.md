# Secrets and Credentials Tracker

## Purpose

This document lists the environment variables that must be populated from Azure
Key Vault or Azure App Settings before running the MLB dashboard and Azure
Functions. Do **not** commit raw secrets to source control.

| Env Var | Secret Reference (Key Vault) | Notes |
|---------|-----------------------------|-------|
| `ODDS_API_KEY` | `oddsapi-main` | Odds API key for MLB odds market features. |
| `MLB_API_URL` | app setting / Key Vault reference | Active MLB model endpoint used by `ModelProxy`. |
| `ORCHESTRATOR_FUNCTIONS_KEY` | `orchestrator-functions-key` | Shared key for protected dashboard write endpoints. |

## Codespaces and GitHub Secrets

- **Codespaces**: Store secrets in GitHub -> Repository -> Settings -> Codespaces -> Secrets. These are injected as env vars automatically.
- **GitHub Actions**: Store CI/CD secrets in repo secrets and map them in workflows.
- **Local/dev sync**: Use `scripts/gh_secret_sync.py` to pull secret names from GitHub and prompt for local values.
- **Auto-auth**: Set `GH_TOKEN` for GitHub CLI and (optionally) `AZURE_CLIENT_SECRET` to enable non-interactive logins in Codespaces.

## Strategy
1. **Store secrets in Key Vault** if not already present.
2. **Map secrets to env vars** before running Azure Functions or deployment scripts. Examples:
   ```powershell
   $vault = 'dashboard-gbsv-kv'
   $env:ODDS_API_KEY = (az keyvault secret show --vault-name $vault --name oddsapi-main --query value -o tsv)
   ```
3. **Local development**: Create a `.env` file from `.env.example` and fill in your values.
4. **Azure Functions**: Configure app settings in Azure Portal or via deployment scripts to reference Key Vault secrets.

## Setting Up Key Vault Secrets

```powershell
# Login to Azure
az login

# Set the Key Vault name
$vault = 'dashboard-gbsv-kv'

# Add secrets (replace YOUR_KEY_HERE with actual values)
az keyvault secret set --vault-name $vault --name "oddsapi-main" --value "YOUR_KEY_HERE"
```

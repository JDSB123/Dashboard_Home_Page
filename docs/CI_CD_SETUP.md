# CI/CD Setup (Azure)

This repo already includes workflows for:

- **Azure Static Web Apps** deploy: `.github/workflows/azure-static-web-apps.yml`
- **Orchestrator Container App** deploy: `.github/workflows/azure-functions-container.yml`
- **Front Door** IaC deploy: `.github/workflows/deploy-frontdoor.yml`
- **Full stack** deploy: `.github/workflows/deploy-all.yml`

## Required GitHub Secrets

### Azure OIDC (recommended)

These are used by all Azure workflows:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Legacy `AZURE_CREDENTIALS` is no longer used; OIDC is the standard.

The service principal should have:

- **Contributor** on the resource group
- **AcrPush** on the ACR registry

### Static Web Apps

- `AZURE_STATIC_WEB_APPS_API_TOKEN`
  - From Azure Portal -> Static Web App -> **Manage deployment token**

### Orchestrator Container App

- `ACR_LOGIN_SERVER`
- `ACR_USERNAME` (optional fallback if managed identity can't be configured)
- `ACR_PASSWORD` (optional fallback if managed identity can't be configured)
- `AZURE_FUNCTIONS_STORAGE_CONNECTION`
- `AZURE_SIGNALR_CONNECTION_STRING`
- `APPINSIGHTS_CONNECTION_STRING`

### Model registry sync/notify (optional)

Used by `.github/workflows/sync-model-registry.yml` and `.github/workflows/model-update-notify.yml`:

- `ORCHESTRATOR_URL`
- `ORCHESTRATOR_FUNCTIONS_KEY`

## Notes

- The Container App workflow uses **OIDC** and logs in to ACR with `az acr login`.
- The workflow prefers managed identity for ACR pull; it will attempt to assign `AcrPull` to the container app identity.
- If managed identity setup fails, it falls back to registry credentials (secrets or ACR admin creds).
- To avoid any fallback, pre-assign `AcrPull` to the container app identity.
- If you want to deploy Front Door automatically, run the `Deploy Azure Front Door Infrastructure` workflow.
- To deploy everything at once, run the `Deploy Full Stack (Front Door + Orchestrator + Static Web App)` workflow.

### Custom domain automation

The full-stack workflow can create and associate the Front Door custom domain. DNS validation is still required:

- Add the TXT and CNAME records from the workflow summary.
- Re-run the workflow to complete route association after validation is approved.

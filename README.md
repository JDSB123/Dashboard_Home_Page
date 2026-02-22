# Green Bier Sport Ventures — Dashboard (Static Front-End)

This repo is a **static HTML/CSS/JS dashboard** hosted on **Azure Static Web Apps**.

## Entry pages

- `index.html` → Dashboard / Active Picks page (uses API) - **Main entry point**
- `weekly-lineup.html` → Weekly Lineup page
- `odds-market.html` → Odds Market page

## Runtime configuration

Production runtime config is injected via:

- `client/config.js` (sets `window.APP_CONFIG`)

Key setting:

- `window.APP_CONFIG.API_BASE_URL` → point to the orchestrator container app FQDN (e.g. `https://<orchestrator>.azurecontainerapps.io/api`)

## Azure Static Web Apps

`staticwebapp.config.json` controls:

- routes/rewrites
- navigation fallback
- global security headers / CSP

Deploy the repository root as the app artifact (there is **no build step** required in this repo).

## CI/CD (GitHub Actions → Azure)

This repo includes an Azure Static Web Apps deployment workflow:

- `.github/workflows/azure-static-web-apps.yml`

Backend (orchestrator) container deploy workflow:

- `.github/workflows/azure-functions-container.yml`

To enable automatic deployments, add this GitHub repo secret:

- `AZURE_STATIC_WEB_APPS_API_TOKEN` (Azure Portal → Static Web App → **Manage deployment token**)

Behavior:

- Pushes to `main` deploy to the production Static Web App
- Pull requests create/update a preview environment and close it when the PR is closed
- Pushes to `main` also build/push the orchestrator container and deploy/update the Container App (requires ACR + Azure credentials secrets)

## CI/CD setup guide

See [docs/CI_CD_SETUP.md](docs/CI_CD_SETUP.md) for the required GitHub secrets and OIDC setup guidance.

## Local dev

Any static server works. Examples:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`.

### Backend (Functions) local dev

The Azure Functions app lives in `azure-functions/`. Quickstart:

```powershell
# 1) Start Azurite (local storage emulator)
npx azurite --silent --location ".azurite" --debug ".azurite\\debug.log"

# 2) Seed required local tables (one-time)
cd azure-functions
npm install
npm run dev:seed-tables

# 3) Start Functions (port configured in local.settings.json, e.g., 7072)
func start
```

Endpoints (examples): `http://localhost:7072/api/picks/NBA`, `http://localhost:7072/api/health`.

## Documentation

See [docs/README.md](docs/README.md) for the full documentation index.

## Production notes

- **Don’t ship third-party API keys to the browser** via `window.APP_CONFIG`. If a key is required, proxy through a server/API layer (Azure Functions/App Service/Container App).
- Ensure your API (configured in `API_BASE_URL`) has **CORS** enabled for your production domain.

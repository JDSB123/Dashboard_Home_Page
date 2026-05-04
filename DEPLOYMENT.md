# GBSV Dashboard Deployment Guide

## Pipeline: Local → Git → CI/CD → ACR/SWA

```
┌─────────────┐    ┌─────────┐    ┌──────────────┐    ┌─────────────────┐
│   Local     │───▶│   Git   │───▶│  GitHub      │───▶│  ACR + SWA      │
│   .dev/     │    │  push   │    │  Actions     │    │  ACA + Static   │
└─────────────┘    └─────────┘    └──────────────┘    └─────────────────┘
```

### Components

| Component          | Deployment Target       | Workflow                        |
| ------------------ | ----------------------- | ------------------------------- |
| `client/`          | Azure Static Web Apps   | `azure-static-web-apps.yml`     |
| `azure-functions/` | Azure Container Apps    | `azure-functions-container.yml` |

---

## 1. LOCAL DEVELOPMENT

### Prerequisites (all in `.dev/`)

```
.dev/
├── dotnet/       .NET 8.0 SDK
├── nuget/        NuGet package cache
├── go-sdk/go/    Go SDK
├── cargo/        Rust packages
├── rustup/       Rust toolchain
├── npm-cache/    npm package cache
├── pip-cache/    Python package cache
├── postgres-data/ PostgreSQL data (if used)
└── azure/        Azure CLI config
```

### Additional Local Directories

```
.azurite/             Local Azurite storage data
```

### Required Files

| File                                  | Purpose           | Git Status    |
| ------------------------------------- | ----------------- | ------------- |
| `.env`                                | Local secrets     | ❌ gitignored |
| `azure-functions/local.settings.json` | Functions secrets | ❌ gitignored |

### Setup Local Environment

```powershell
# Copy templates
Copy-Item .env.example .env
Copy-Item azure-functions/local.settings.sample.json azure-functions/local.settings.json

# Bootstrap the workspace
npm run bootstrap
```

### Required Secrets in `.env`

```bash
# API Keys
SDIO_KEY=your-sportsdataio-key
ODDS_API_KEY=your-odds-api-key
BASKETBALL_API_KEY=your-basketball-api-key
ACTIONNETWORK_USER=your-email
ACTIONNETWORK_PASS=your-password

# Azure
AZURE_SUBSCRIPTION_ID=xxx
AZURE_TENANT_ID=xxx
AZURE_STORAGE_CONNECTION_STRING=xxx
AZURE_SIGNALR_CONNECTION_STRING=xxx

# Vision API (for OCR)
AZURE_VISION_ENDPOINT=https://xxx.cognitiveservices.azure.com/
AZURE_VISION_KEY=xxx
```

### Run Locally

```powershell
# Frontend only
python -m http.server 8080

# Functions + Azurite
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-dev.ps1 -Port 7072
```

---

## 2. GIT

### Branch Strategy

- `main` - Production (triggers deploy)
- `feature/*` - Development branches

### Path-based Triggers

Workflows only run when relevant files change:

- `azure-functions/**` → Functions container workflow
- `client/**` → Static Web Apps workflow
---

## 3. CI/CD (GitHub Actions)

### Workflows

| Workflow                        | Trigger              | Deploys To            |
| ------------------------------- | -------------------- | --------------------- |
| `azure-static-web-apps.yml`     | `client/**`          | Azure Static Web Apps |
| `azure-functions-container.yml` | `azure-functions/**` | ACA via ACR           |
| `deploy-all.yml`                | Manual               | Everything            |

### GitHub Secrets Required

Configure in: `Repo → Settings → Secrets and variables → Actions`

| Secret                            | Description                  |
| --------------------------------- | ---------------------------- |
| `AZURE_CLIENT_ID`                 | Service principal app ID     |
| `AZURE_TENANT_ID`                 | Azure AD tenant ID           |
| `AZURE_SUBSCRIPTION_ID`           | Azure subscription ID        |
| `ACR_LOGIN_SERVER`                | `gbsvregistry.azurecr.io`    |
| `ACR_USERNAME`                    | (optional, can auto-resolve) |
| `ACR_PASSWORD`                    | (optional, can auto-resolve) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token         |

### App Secrets (in ACA, not GitHub)

Set as ACA environment variables or Key Vault references:

- `SDIO_KEY`
- `ODDS_API_KEY`
- `BASKETBALL_API_KEY`
- `AZURE_SIGNALR_CONNECTION_STRING`
- `COSMOS_ENDPOINT` / `COSMOS_KEY`

---

## 4. ACR (Azure Container Registry)

### Image Naming

```
gbsvregistry.azurecr.io/gbsv-orchestrator:<commit-sha>
```

### Manual Push

```powershell
az acr login --name gbsvregistry
docker build -t gbsvregistry.azurecr.io/gbsv-orchestrator:manual -f azure-functions/Dockerfile azure-functions
docker push gbsvregistry.azurecr.io/gbsv-orchestrator:manual
```

---

## 5. AZURE RESOURCES

### Static Web Apps (Frontend)

- **URL**: `https://www.greenbiersportventures.com`
- **Deployment**: Automatic from `client/` folder

### Container Apps (Functions)

- **URL**: `https://gbsv-orchestrator.xxx.azurecontainerapps.io`
- **Image**: From ACR

### Infrastructure as Code

```powershell
# Deploy all infra
az deployment group create `
  --resource-group dashboard-gbsv-main-rg `
  --template-file infra/main.bicep `
  --parameters infra/main.bicepparam
```

---

## Quick Reference

### URLs

| Environment | Component | URL                                                        |
| ----------- | --------- | ---------------------------------------------------------- |
| Local       | Frontend  | `http://localhost:5500`                                    |
| Local       | Functions | `http://localhost:7072/api/`                               |
| Prod        | Frontend  | `https://www.greenbiersportventures.com`                   |
| Prod        | Functions | `https://gbsv-orchestrator.xxx.azurecontainerapps.io/api/` |

### Commands

```powershell
# Frontend
python -m http.server 8080

# Functions
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-dev.ps1 -Port 7072

# Deploy all (via CI/CD)
git push origin main
```

---

## Environment Variable Reference

### Azure Functions (`azure-functions/local.settings.json`)

```json
{
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SDIO_KEY": "xxx",
    "ODDS_API_KEY": "xxx",
    "BASKETBALL_API_KEY": "xxx",
    "COSMOS_ENDPOINT": "https://xxx.documents.azure.com:443/",
    "COSMOS_KEY": "xxx",
    "AZURE_SIGNALR_CONNECTION_STRING": "Endpoint=https://xxx",
    "AZURE_VISION_ENDPOINT": "https://xxx.cognitiveservices.azure.com/",
    "AZURE_VISION_KEY": "xxx"
  }
}
```

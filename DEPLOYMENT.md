# Dashboard Home Page - Deployment Guide

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
| `data-pipeline/`   | Manual / GitHub Actions | `python-ci.yml`                 |

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
.venv/           Python virtual environment
.azurite/        (in NBA v3 folder, shared)
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

# Setup Python venv
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r data-pipeline/requirements.txt

# Setup Node.js
cd azure-functions
npm install
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
cd client
npx live-server

# Functions only
cd azure-functions
func start

# Python data pipeline
cd data-pipeline
python fetch_nba_scores.py
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
- `data-pipeline/**` → Python CI workflow

---

## 3. CI/CD (GitHub Actions)

### Workflows

| Workflow                        | Trigger              | Deploys To            |
| ------------------------------- | -------------------- | --------------------- |
| `azure-static-web-apps.yml`     | `client/**`          | Azure Static Web Apps |
| `azure-functions-container.yml` | `azure-functions/**` | ACA via ACR           |
| `python-ci.yml`                 | `data-pipeline/**`   | Tests only            |
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
| Local       | Functions | `http://localhost:7071/api/`                               |
| Prod        | Frontend  | `https://www.greenbiersportventures.com`                   |
| Prod        | Functions | `https://gbsv-orchestrator.xxx.azurecontainerapps.io/api/` |

### Commands

```powershell
# Frontend
cd client && npx live-server

# Functions
cd azure-functions && npm install && func start

# Python
cd data-pipeline && python fetch_nba_scores.py

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

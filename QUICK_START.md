# Quick Start Guide - Dashboard Local Development

## Prerequisites

- **Node.js** 18+ and npm
- **Azure Functions Core Tools** v4
- **Python** 3.9+ (for data pipeline scripts)
- **Git**
- **VS Code** (recommended)

## Getting Started

### 1. Clone and Setup

```powershell
# Navigate to project directory
cd Dashboard_main_local

# Install Azure Functions dependencies
cd azure-functions
npm install
cd ..
```

### 1b. Environment & Secrets

- Local/dev: `cp .env.example .env` and fill in values (gitignored).
- Codespaces: set secrets in GitHub -> Repository -> Settings -> Codespaces -> Secrets.
- Optional: run `scripts/gh_secret_sync.py` to pull secret names from GitHub and prompt for local values.
- Optional: set `GH_TOKEN` and `AZURE_CLIENT_SECRET` as Codespaces secrets to enable non-interactive CLI auth on start.

### 2. Local Development with Azure Functions

#### Start Functions Locally

**Option A: Using VS Code Tasks** (Recommended)

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `Tasks: Run Task`
3. Select: `func: host start`

**Option B: Terminal**

```powershell
cd azure-functions
func host start
```

The Functions host will start on `http://localhost:7071`

#### Available Functions (Endpoints)

- **Health**: `GET /api/Health`
- **ModelJobProcessor**: Timer-triggered job processor
- **ModelOrchestrator**: Orchestrates model execution
- **ModelRegistry**: `GET /api/ModelRegistry` - Model metadata
- **ModelStatus**: `GET /api/ModelStatus` - Current job statuses
- **SignalRInfo**: `GET /api/SignalRInfo` - SignalR connection info
- **TelegramRunner**: Telegram integration endpoint

### 3. Configuration

#### Azure Functions Local Settings

Create/update `azure-functions/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "CosmosDbConnectionString": "<your-cosmos-connection>",
    "TELEGRAM_BOT_TOKEN": "<your-telegram-token>",
    "SPORTSDATAIO_API_KEY": "<your-key>",
    "API_BASKETBALL_KEY": "<your-key>"
  }
}
```

#### Client Configuration

Create `client/config.js` from `client/config.template.js`:

```javascript
const config = {
  apiBaseUrl: "http://localhost:7071/api",
  signalRUrl: "http://localhost:7071",
  // ... other settings
};
```

### 4. Python Data Pipeline (Optional)

For pick parsing and P&L tracking:

```powershell
# Install dependencies
cd tracker_pnl
pip install -r requirements.txt

# Test pick parser
python example_usage.py

# Fetch box scores
python fetch_box_scores.py --date 2026-01-10 --league NBA
```

See [tracker_pnl/README.md](tracker_pnl/README.md) for full documentation.

### 5. Testing

#### Test Azure Functions Health Endpoint

```powershell
# Once Functions are running:
curl http://localhost:7071/api/Health
```

Expected response: `200 OK`

#### Test Client Dashboard

```powershell
# Serve client files (simple HTTP server)
cd client
python -m http.server 8080
```

Open browser: `http://localhost:8080`

## VS Code Tasks

The workspace includes pre-configured tasks:

- **npm install (functions)**: Install Azure Functions dependencies
- **func: host start**: Start Functions host (with auto-install)
- **npm prune (functions)**: Clean up production dependencies

Access via: `Terminal > Run Task...`

## Debugging

### Attach Debugger to Functions

1. Start Functions: `Tasks: Run Task > func: host start`
2. Start debugging: `F5` or `Run > Start Debugging`
3. Select: **Attach to Node Functions**

Breakpoints in `azure-functions/**/*.js` will now be hit.

## Common Issues

### Functions won't start

**Issue**: `The term 'func' is not recognized...`
**Fix**: Install Azure Functions Core Tools:

```powershell
npm install -g azure-functions-core-tools@4
```

**Issue**: `Cannot find module '@azure/...'`
**Fix**: Reinstall dependencies:

```powershell
cd azure-functions
rm -r node_modules package-lock.json
npm install
```

### Port Already in Use

**Issue**: `EADDRINUSE: address already in use :::7071`
**Fix**: Stop existing Functions process or change port:

```powershell
func host start --port 7072
```

### Client Can't Connect to Functions

**Fix**: Update `client/config.js` to match your Functions port.

## Project Structure

```
Dashboard_main_local/
├── azure-functions/        # Azure Functions (Node.js)
│   ├── Health/
│   ├── ModelOrchestrator/
│   ├── ModelRegistry/
│   └── ...
├── client/                 # Static web dashboard
│   ├── index.html
│   ├── dashboard/
│   └── config.js
├── tracker_pnl/           # Python pick tracking & P&L
│   ├── src/
│   ├── box_scores/
│   └── requirements.txt
├── data-pipeline/         # Data processing scripts
├── infra/                 # Bicep infrastructure templates
└── docs/                  # Documentation

```

## Next Steps

- Review [docs/DEPLOYMENT_COMPLETE_GUIDE.md](docs/DEPLOYMENT_COMPLETE_GUIDE.md) for deployment to Azure
- Explore [docs/](docs/) for feature-specific guides

## Additional Resources

- [Azure Functions Docs](https://learn.microsoft.com/azure/azure-functions/)
- [Cosmos DB Best Practices](docs/COSMOS_DB_GUIDE.md)
- [Model Registry Setup](docs/SETUP_MODEL_REGISTRY.md)
- [Secret Keys Management](docs/SECRET_KEYS.md)

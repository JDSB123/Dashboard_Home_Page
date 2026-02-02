# Dashboard Development Codespace

This directory contains the GitHub Codespaces configuration for the Dashboard project.

## Quick Start

### Option 1: Create a Codespace on GitHub
1. Go to: https://github.com/JDSB123/Dashboard_Home_Page
2. Click **Code** → **Codespaces** → **Create codespace on main**
3. VS Code will open with all tools pre-configured

### Option 2: Open Locally with Devcontainer (VS Code)
1. Install [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
2. Open the repo folder in VS Code
3. Press `Ctrl+Shift+P` → **Dev Containers: Reopen in Container**
4. VS Code will build and connect to the devcontainer

## What's Included

- **Node.js & npm** - For tooling
- **Python 3** - For running local HTTP servers
- **Azure CLI** - For Azure resource management
- **Live Server** - For auto-refreshing local development
- **Prettier & ESLint** - For code formatting and linting
- **VS Code Extensions** - Azure Static Web Apps, Cosmos DB, Live Server

## Running the Dashboard Locally

### Using Python (Built-in)
```bash
cd /workspace
python3 -m http.server 8000
# Access: http://localhost:8000
```

### Using Node's http-server
```bash
cd /workspace
npx http-server -p 8000
```

### Using Live Server (auto-refresh)
```bash
cd /workspace
live-server --port=8000
```

## Configuration

Use `.env.example` → `.env` for local/dev configuration. In Codespaces, prefer repository Codespaces secrets (auto-injected as env vars).

- Azure subscription/resource group IDs
- API endpoint URLs (for connecting to the backend orchestrator)
- Cosmos DB credentials (if using emulator)

Optional: run `scripts/gh_secret_sync.py` to pull secret names from GitHub and prompt for local values.
Optional: set `GH_TOKEN` and `AZURE_CLIENT_SECRET` as Codespaces secrets to enable non-interactive CLI auth on start.

## VS Code Extensions

Pre-installed extensions:
- **Azure Static Web Apps** - Manage SWA deployments
- **Azure Account** - Azure authentication
- **Azure Cosmos DB** - Cosmos DB exploration
- **Live Server** - Live reload
- **Prettier** - Code formatting
- **ESLint** - JavaScript linting

## Ports Forwarded

- **8000** - HTTP Server (Dashboard)
- **3000** - Dev Server
- **5000** - Backend/Flask Server

## Debugging & Logs

View devcontainer logs in VS Code:
```
Ctrl+Shift+` → Select "Devcontainer Log" tab
```

## Tips

- **Sync settings**: VS Code automatically syncs extensions and settings across codespaces
- **Keep workspaces clean**: Delete unused codespaces to save hours
- **Terminal integration**: Full terminal access inside VS Code
- **Git integration**: Git already configured; ready to commit/push
- **Dependencies**: After changing `requirements.txt` or `requirements-dev.txt`, rebuild the devcontainer to bake dependencies into the image

## Next Steps

1. Verify the dashboard runs locally
2. Test API connectivity to the backend
3. Configure Azure credentials for deployments
4. Push `.devcontainer/` changes to trigger codespace updates

## References

- [GitHub Codespaces Docs](https://docs.github.com/en/codespaces)
- [Dev Containers Spec](https://containers.dev/)
- [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/)

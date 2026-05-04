# Quick Start Guide

## Prerequisites

- **Node.js** `20.x`
- **Azure Functions Core Tools** v4
- **Git**
- **VS Code / Cursor** (recommended)

## Bootstrap

From the repo root:

```powershell
cd gbsv_dashboard
npm run bootstrap
```

This installs:

- repo-local tooling such as Azurite
- `client` dependencies
- `azure-functions` dependencies

## Local Secrets

- Copy `.env.example` to `.env`
- Copy `azure-functions/local.settings.sample.json` to `azure-functions/local.settings.json`
- Fill in any required local keys and connection strings

## Start Local Development

### Option A: VS Code task

1. Open `Tasks: Run Task`
2. Run `Bootstrap Workspace` once on a fresh checkout
3. Run `Start Local Dev (Azurite + Functions)`

### Option B: Terminal

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-dev.ps1 -Port 7072
```

The Azure Functions host runs on `http://localhost:7072`.

## Frontend

The canonical app page is `client/dashboard.html`.
`client/index.html` is only a redirect to `/dashboard.html`.

To preview the static frontend locally:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080/dashboard.html`.

## Useful Endpoints

- Health: `http://localhost:7072/api/health`
- Picks: `http://localhost:7072/api/picks/NBA`

## Debugging

To attach a debugger to Functions:

1. Run `func: host start`
2. Press `F5`
3. Select `Attach to Node Functions`

## Common Issues

### `func` is not recognized

Install Azure Functions Core Tools v4.

### Port `7072` is already in use

Run the `kill-port-7072` task or stop the existing process and rerun local dev.

### Client cannot reach the API

Ensure your client runtime config points at `http://localhost:7072`.

# Releasing & Repo Hygiene

This repo is a static front-end hosted on **Azure Static Web Apps** with a backend/orchestrator hosted as an **Azure Container App** (built from `azure-functions/`).

## What should never be committed

- Local config: `.claude/`, `.env`, `azure-functions/local.settings.json`
- Generated caches/outputs: `pick-analysis-tracker/cache/`, `pick-analysis-tracker/output/`
- Virtualenvs/caches: `.venv/`, `.mypy_cache/`

## Tagging (recommended)

Use simple, consistent tags:

- UI releases: `ui-vMAJOR.MINOR.PATCH` (example: `ui-v33.2.0`)
- Backend/orchestrator: images are already tagged by commit SHA; optionally tag git as `orchestrator-<shortsha>`

## Deploy behavior

- Push to `main` deploys the Static Web App (`.github/workflows/azure-static-web-apps.yml`)
- Changes under `azure-functions/**` deploy the orchestrator via GitHub Actions (`.github/workflows/azure-functions-container.yml`)
- You can also deploy the orchestrator locally with `docker` + `az containerapp update` (see `azure-functions/README.md`)


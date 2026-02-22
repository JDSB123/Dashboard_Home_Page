# Configuration Reference

## Frontend (client/config.js)

Runtime settings live in client/config.js (and the template client/config.template.js). The most important keys:

- API_BASE_URL: Base for orchestrator API (e.g., https://<orchestrator>/api)
- FUNCTIONS_BASE_URL: Base for Functions host (e.g., https://<orchestrator>)
- API_BASE_FALLBACK: Optional fallback base for frontdoor or alternate API
- DYNAMIC_REGISTRY_ENABLED: When true, registry bootstrap updates model endpoints
- _\_API_URL / _\_FUNCTION_URL: Optional per-model overrides

## Backend (Azure Functions)

Environment variables are listed in .env.example. Key settings:

- AzureWebJobsStorage
- MODEL_REGISTRY_TABLE / MODEL_EXECUTIONS_TABLE
- NBA_API_URL / NCAAM_API_URL / NFL_API_URL / NCAAF_API_URL (optional overrides)
- CORS_ALLOWED_ORIGINS
- ORCHESTRATOR_URL / FUNCTIONS_BASE_URL / API_BASE_URL

Cosmos DB defaults used by local and recommended in prod:

- COSMOS_DATABASE: `picks-db`
- COSMOS_CONTAINER: `picks`
- Partition Key: `/sport`

Optional auth guards (set to true to require a shared key on write endpoints):

- REQUIRE_EXECUTE_KEY
- REQUIRE_REGISTRY_WRITE_KEY
- REQUIRE_PICKS_WRITE_KEY
- REQUIRE_ARCHIVE_WRITE_KEY
- REQUIRE_NOTIFY_KEY

## Model Registry

Model endpoints should be managed through the registry whenever possible. The registry is hydrated by:

- .github/workflows/sync-model-registry.yml
- .github/workflows/model-update-notify.yml

If the registry is unavailable, defaults are taken from environment overrides or config.js.

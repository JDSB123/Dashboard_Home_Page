# GBSV Dashboard Architecture

This document summarizes the major components and how they interact.

```mermaid
flowchart TD
  A[User Browser] --> B[Azure Front Door\nCustom domain, TLS]
  B --> C[Static Web Client\nclient/]
  C -->|fetch| D[Azure Functions API\nazure-functions/]
  D -->|/api/picks/*| E[(Cosmos DB Serverless\npicks-db / picks, metrics)]
  D -->|/api/signalr/*| F[Azure SignalR Service]
  D -->|/api/scoreboard/*\n/api/basketball-api/*| G[External Sports APIs\nESPN, API-Basketball, Odds]
  D -->|/api/teams-notify\n/api/telegram/*| H[Teams / Telegram]
  D -->|Secrets| I[Azure Key Vault]
  subgraph Local Dev
    J[Azurite\n(Storage Emulator)]
  end
  D -->|AzureWebJobsStorage| J
  C -->|WebSocket| F
```

Key points:

- Static UI served via Front Door; Functions provide APIs under `/api/*`.
- Picks and metrics persisted in Cosmos DB `picks-db` (`picks`, `metrics`), partition key `/sport`.
- Local development uses Azurite for `AzureWebJobsStorage` and a small script to seed the `modelregistry` table.

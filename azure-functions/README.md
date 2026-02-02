# GBSV Dashboard Functions

Azure Functions for the GBSV Dashboard - Picks storage, notifications, and live data.

## Architecture

```
www.greenbiersportventures.com (Front Door)
    │
    ├── /{sport}/predictions  → Sport Container Apps (NBA, NFL, etc.)
    ├── /picks/*              → PicksAPI (this Functions app)
    └── /*                    → Static Web App (Dashboard UI)
```

**Sport APIs generate predictions. Dashboard Functions store and manage picks.**

## Functions

| Function           | Route               | Description                               |
| ------------------ | ------------------- | ----------------------------------------- |
| **PicksAPI**       | `/picks/*`          | Sport-partitioned Cosmos DB picks storage |
| **Health**         | `/health`           | Service health check                      |
| **Scoreboard**     | `/scoreboard/*`     | Live scores from basketball API           |
| **SignalRInfo**    | `/signalr/*`        | Real-time connection negotiation          |
| **TeamsNotify**    | `/teams-notify`     | MS Teams webhook notifications            |
| **TelegramRunner** | `/telegram/*`       | Telegram bot integration                  |
| **SportsbookAPI**  | `/sportsbook/*`     | Sportsbook connection/bets                |
| **BasketballAPI**  | `/basketball-api/*` | NBA/NCAAM data proxy                      |
| **OCR**            | `/ocr`              | Image processing                          |

## PicksAPI Routes

### List Picks

```
GET /picks                    - All picks (supports ?sport=NBA filter)
GET /picks/{sport}            - All picks for sport (NBA, NFL, NCAAM, NCAAF)
GET /picks/{sport}/active     - Active/pending picks
GET /picks/{sport}/settled    - Settled picks (W/L/P)
GET /picks/{sport}/archived   - Archived historical picks
```

### Single Pick

```
GET    /picks/{sport}/{id}    - Get specific pick
PATCH  /picks/{sport}/{id}    - Update pick status/result
DELETE /picks/{sport}/{id}    - Delete pick
```

### Create

```
POST   /picks                 - Create pick(s) - sport auto-detected
POST   /picks/{sport}         - Create pick(s) for specific sport
```

### Admin

```
POST   /picks/{sport}/archive - Archive all settled picks
DELETE /picks/{sport}/clear   - Clear all (requires x-confirm-clear header)
```

### Query Parameters

```
?status=pending,live          - Filter by status
?date=2026-02-02              - Filter by game date
?from=2026-01-01&to=2026-01-31 - Date range
?sportsbook=DraftKings        - Filter by book
?limit=50                     - Limit results (default: 100)
```

## Cosmos DB Schema

```
Database: gbsv-picks
Container: picks
Partition Key: /sport
```

```json
{
  "id": "NBA-2026-02-02-lakers-celtics-abc123",
  "sport": "NBA",
  "status": "pending",
  "gameDate": "2026-02-02",
  "game": "Lakers @ Celtics",
  "pickType": "spread",
  "pickTeam": "Lakers",
  "line": "+3.5",
  "odds": "-110",
  "risk": 110,
  "toWin": 100,
  "sportsbook": "DraftKings",
  "createdAt": "2026-02-02T10:00:00Z"
}
```

## Local Development

```bash
# Install dependencies
npm install

# Copy and configure settings
cp local.settings.sample.json local.settings.json
# Edit with your Cosmos DB, Key Vault, etc. values

# Start functions
npm start
# or
func start
```

## Environment Variables

| Variable                          | Description                               |
| --------------------------------- | ----------------------------------------- |
| `COSMOS_ENDPOINT`                 | Cosmos DB account endpoint                |
| `COSMOS_KEY`                      | Cosmos DB primary key (or use Key Vault)  |
| `COSMOS_DATABASE`                 | Database name (default: gbsv-picks)       |
| `COSMOS_CONTAINER`                | Container name (default: picks)           |
| `AzureWebJobsStorage`             | Azure Storage connection string           |
| `AZURE_SIGNALR_CONNECTION_STRING` | SignalR Service connection                |
| `REQUIRE_PICKS_WRITE_KEY`         | Set to require x-functions-key for writes |

## Deployment

### GitHub Actions (Recommended)

Push to `main` triggers `.github/workflows/azure-functions.yml`

Required secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- `COSMOS_ENDPOINT`, `COSMOS_KEY`
- `AzureWebJobsStorage`

### Manual Deploy

```powershell
# Windows
.\deploy.ps1

# Linux/Mac
./deploy.sh
```

## Removed Functions (v2.0)

The following redundant functions were removed:

- `ModelOrchestrator` - Sport APIs have built-in async
- `ModelJobProcessor` - Sport APIs have built-in queues
- `ModelRegistry` - Use Key Vault + env vars
- `ModelStatus` - No longer needed
- `ArchivePicks` - PicksAPI handles with status=archived
- `ArchivePicksGet` - PicksAPI queries handle historical
- `WeeklyLineup` - Front Door direct routing replaces this

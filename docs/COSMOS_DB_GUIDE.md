# Cosmos DB Picks Archival - Implementation Guide

## Overview
Azure Cosmos DB is now your permanent archive for:
- **Picks**: Individual predictions (one document per pick)
- **Metrics**: Aggregated stats (win rate, ROE, PnL by league/season)

## Infrastructure

### Account
- **Name**: gbsv-picks-db
- **Endpoint**: https://gbsv-picks-db.documents.azure.com:443/
- **Region**: East US
- **Pricing**: ~$25-50/month (serverless, pay-per-request)

### Database & Collections
- **Database**: picks-db
- **Collections**:
  - `picks` - Partition key: `/league`
  - `metrics` - Partition key: `/league`

## Pick Document Schema

```json
{
  "id": "nba-2025-12-28-lakers-vs-celtics",
  "league": "NBA",
  "date": "2025-12-28",
  "season": 2025,
  "matchup": "Lakers vs Celtics",
  "pick": "Lakers -3.5",
  "odds": -110,
  "risk": 100.00,
  "to_win": 90.91,
  "segment": "1H",
  "result": "WIN",
  "pnl": 90.91,
  "model": "nba-gbsv-api v2.1",
  "timestamp": "2025-12-28T14:30:00Z",
  "hit_miss": "HIT"
}
```

## Metrics Document Schema

```json
{
  "id": "nba-2025-season",
  "league": "NBA",
  "season": 2025,
  "picks_count": 127,
  "wins": 71,
  "losses": 56,
  "pushes": 0,
  "win_rate": 0.5590,
  "total_risk": 12700.00,
  "total_pnl": 1205.50,
  "roe": 0.0948,
  "avg_odds": -108.00,
  "timestamp": "2025-12-28T14:30:00Z"
}
```

## Usage with Python

### Setup Environment Variables
```bash
# In your shell or .env file
export COSMOS_ENDPOINT="https://gbsv-picks-db.documents.azure.com:443/"
export COSMOS_KEY="<your-primary-key>"
```

### Basic Operations

```python
from lib.cosmos_client import CosmosPicksClient

client = CosmosPicksClient()

# Insert a pick
pick = {
    "id": "nba-2025-12-28-lakers-vs-celtics",
    "league": "NBA",
    "date": "2025-12-28",
    "season": 2025,
    "matchup": "Lakers vs Celtics",
    "pick": "Lakers -3.5",
    "odds": -110,
    "risk": 100,
    "to_win": 90.91,
    "result": "WIN",
    "pnl": 90.91,
    "segment": "1H",
    "model": "nba-gbsv-api v2.1"
}
client.insert_pick(pick)

# Query picks by league
nba_picks = client.query_picks(league="NBA", season=2025)

# Calculate metrics from picks
metrics = client.calculate_season_metrics(nba_picks)
metrics["league"] = "NBA"
metrics["season"] = 2025
metrics["id"] = "nba-2025-season"
client.upsert_metrics(metrics)

# Get metrics for a league
nba_metrics = client.get_metrics(league="NBA", season=2025)
print(f"NBA ROE: {nba_metrics['roe']}")
```

## Migration from CSV Files

Use this to migrate your existing picks data:

```python
import pandas as pd
from lib.cosmos_client import CosmosPicksClient

client = CosmosPicksClient()

# Load CSV
df = pd.read_csv('output/reconciled/pnl_tracker_2025-12-28.csv')

# Transform to Cosmos format
picks = []
for idx, row in df.iterrows():
    pick_doc = {
        "id": f"{row['League'].lower()}-{row['Date'].replace('/', '-')}-{idx}",
        "league": row['League'],
        "date": row['Date'],
        "matchup": row['Matchup'],
        "pick": row['Pick'],
        "odds": float(row['Odds']),
        "risk": float(row['To Risk']),
        "to_win": float(row['To Win']),
        "result": row['Hit/Miss'].upper(),
        "pnl": float(row['PnL']),
        "segment": row.get('Segment', 'Full'),
        "model": "imported-from-csv"
    }
    picks.append(pick_doc)

# Batch insert
inserted = client.insert_picks_batch(picks)
print(f"Inserted {inserted} picks into Cosmos DB")
```

## Integration with Your Scripts

### Update `reconcile_nfl_scores.py`

```python
from lib.cosmos_client import CosmosPicksClient

client = CosmosPicksClient()

# Instead of: df.to_csv(...)
# Do this:
for _, row in df.iterrows():
    pick_doc = {
        "id": f"nfl-{row['Date']}-{row['Matchup']}",
        "league": "NFL",
        "date": row['Date'],
        "matchup": row['Matchup'],
        "pick": row['Pick'],
        "odds": row['Odds'],
        "risk": row['To Risk'],
        "to_win": row['To Win'],
        "result": row['Hit/Miss'],
        "pnl": row['PnL']
    }
    client.insert_pick(pick_doc)
```

### Update `run_telegram_analysis.py`

```python
from lib.cosmos_client import CosmosPicksClient

client = CosmosPicksClient()

# After parsing telegram picks:
for pick in parsed_picks:
    client.insert_pick(pick)

# Generate metrics for dashboard
picks = client.query_picks(league="NBA", season=2025)
metrics = client.calculate_season_metrics(picks)
client.upsert_metrics({
    "id": f"nba-2025-daily",
    "league": "NBA",
    "season": 2025,
    **metrics
})
```

## Dashboard Integration

### API Endpoint for Metrics

```javascript
// In your dashboard frontend (client/picks-metrics.js)
async function getMetrics(league, season) {
    const response = await fetch(`/api/metrics?league=${league}&season=${season}`);
    return response.json();
}

async function displayMetrics() {
    const nba = await getMetrics('NBA', 2025);
    document.getElementById('nba-roe').textContent = `${(nba.roe * 100).toFixed(2)}%`;
    document.getElementById('nba-winrate').textContent = `${(nba.win_rate * 100).toFixed(1)}%`;
    document.getElementById('nba-pnl').textContent = `$${nba.total_pnl.toFixed(2)}`;
}
```

### Azure Function to Serve Metrics

```csharp
// in azure-functions/GetMetrics/index.js
const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const { league, season } = req.query;
    
    const client = new CosmosClient({
        endpoint: process.env.COSMOS_ENDPOINT,
        key: process.env.COSMOS_KEY
    });
    
    const database = client.getDatabase("picks-db");
    const container = database.getContainer("metrics");
    
    const query = `SELECT * FROM c WHERE c.league = '${league}' AND c.season = ${season}`;
    const { resources } = await container.items.query(query).fetchAll();
    
    context.res = {
        status: 200,
        body: resources[0] || {}
    };
};
```

## Querying Cosmos DB

### Via Azure Portal
1. Go to Azure Portal → gbsv-picks-db
2. Click "Data Explorer"
3. Select picks-db → picks
4. Use Query Editor

### Example Queries

```sql
-- All NBA picks in 2025
SELECT * FROM c WHERE c.league = "NBA" AND c.season = 2025

-- Winning picks
SELECT * FROM c WHERE c.league = "NBA" AND c.result = "WIN"

-- High-risk picks
SELECT * FROM c WHERE c.risk > 500 ORDER BY c.pnl DESC

-- Picks by segment
SELECT c.segment, COUNT(1) as count, SUM(c.pnl) as total_pnl 
FROM c WHERE c.league = "NBA" 
GROUP BY c.segment
```

## Best Practices

1. **Always set partition key** (`league`) - required for efficient queries
2. **Use unique IDs** - Format: `{league}-{date}-{matchup-or-index}`
3. **Archive old picks** - Keep in Cosmos, don't delete (audit trail)
4. **Batch operations** - Use `insert_picks_batch()` for multiple picks
5. **Calculate metrics daily** - Run after each day's picks are graded
6. **Monitor RU consumption** - View in Azure Portal → Metrics

## Cost Estimate

| Operation | Cost |
|-----------|------|
| ~3,000 picks/season | $0.12 |
| ~10 metric docs | $0.0001 |
| 1,000 reads/day | ~$5/month |
| **Total monthly** | **~$25-50** |

(Prices vary based on usage - serverless, pay-per-request)

## Files

- **Infrastructure**: `infra/cosmos-picks-db.bicep`
- **Python Client**: `lib/cosmos_client.py`
- **Connection**: Set `COSMOS_ENDPOINT` and `COSMOS_KEY` env vars

## Next Steps

1. Migrate existing CSV files to Cosmos DB
2. Update `reconcile_nfl_scores.py` to write to Cosmos
3. Update `run_telegram_analysis.py` to write to Cosmos
4. Create dashboard endpoint to serve metrics
5. Build KPI display on `/picks` page

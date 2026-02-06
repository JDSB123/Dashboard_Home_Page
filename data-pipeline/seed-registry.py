#!/usr/bin/env python3
"""Seed modelregistry table with default endpoints.

Endpoint URLs are read from environment variables (set via load-secrets.sh or
GitHub Variables). No hardcoded infrastructure URLs.
"""

from azure.data.tables import TableServiceClient, TableEntity
import os
from datetime import datetime, timezone

# Get connection string from environment
conn_str = os.environ.get("AZURE_FUNCTIONS_STORAGE_CONNECTION")
if not conn_str:
    raise ValueError("AZURE_FUNCTIONS_STORAGE_CONNECTION environment variable not set")

# Model endpoints from environment variables — must be set before running
_REQUIRED_VARS = {
    "nba": "NBA_API_URL",
    "ncaam": "NCAAM_API_URL",
    "nfl": "NFL_API_URL",
    "ncaaf": "NCAAF_API_URL",
}

endpoints = {}
missing = []
for model, env_var in _REQUIRED_VARS.items():
    url = os.environ.get(env_var)
    if not url:
        missing.append(env_var)
    else:
        endpoints[model] = url

if missing:
    raise ValueError(
        f"Missing required environment variables: {', '.join(missing)}\n"
        "Set them via: . ./scripts/load-secrets.sh  or configure GitHub Variables."
    )

# Connect to table
service = TableServiceClient.from_connection_string(conn_str)
table_client = service.get_table_client("modelregistry")

# Seed each endpoint
for model, endpoint in endpoints.items():
    entity = TableEntity()
    entity["PartitionKey"] = model
    entity["RowKey"] = "current"
    entity["version"] = "1.0.0"
    entity["endpoint"] = endpoint
    entity["lastUpdated"] = datetime.now(timezone.utc).isoformat()
    entity["healthy"] = True

    table_client.upsert_entity(entity)
    print(f"✅ {model}: {endpoint}")

print("\n🎉 Registry seeded successfully!")

#!/usr/bin/env python3
"""Seed modelregistry table with default endpoints."""

from azure.data.tables import TableServiceClient, TableEntity
import os
from datetime import datetime, timezone

# Get connection string from environment
conn_str = os.environ.get('AZURE_FUNCTIONS_STORAGE_CONNECTION')
if not conn_str:
    raise ValueError("AZURE_FUNCTIONS_STORAGE_CONNECTION environment variable not set")

# Model endpoints from client/config.js
endpoints = {
    'nba': 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
    'ncaam': 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io',
    'nfl': 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
    'ncaaf': 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'
}

# Connect to table
service = TableServiceClient.from_connection_string(conn_str)
table_client = service.get_table_client('modelregistry')

# Seed each endpoint
for model, endpoint in endpoints.items():
    entity = TableEntity()
    entity['PartitionKey'] = model
    entity['RowKey'] = 'current'
    entity['version'] = '1.0.0'
    entity['endpoint'] = endpoint
    entity['lastUpdated'] = datetime.now(timezone.utc).isoformat()
    entity['healthy'] = True
    
    table_client.upsert_entity(entity)
    print(f"✅ {model}: {endpoint}")

print("\n🎉 Registry seeded successfully!")

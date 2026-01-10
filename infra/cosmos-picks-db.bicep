param location string = 'eastus'
param environment string = 'prod'
param projectName string = 'gbsv'

// Cosmos DB Account for picks archival and metrics
resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${projectName}-picks-db'
  location: location
  kind: 'GlobalDocumentDB'
  
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
      maxIntervalInSeconds: 5
      maxStalenessPrefix: 100
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    enableAutomaticFailover: true
    enableMultipleWriteLocations: false
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

// Database for picks and metrics
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosDbAccount
  name: 'picks-db'
  properties: {
    resource: {
      id: 'picks-db'
    }
  }
}

// Picks collection - stores individual pick predictions
// Partitioned by league (NBA, NFL, NCAAM, NCAAF, NCAAF)
resource picksContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'picks'
  properties: {
    resource: {
      id: 'picks'
      partitionKey: {
        paths: [
          '/league'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      defaultTtl: -1 // No expiration
    }
    options: {
      throughput: 400
    }
  }
}

// Metrics collection - stores aggregated stats by league/season
// Used for dashboard KPIs (win rate, ROE, ROI, etc.)
resource metricsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'metrics'
  properties: {
    resource: {
      id: 'metrics'
      partitionKey: {
        paths: [
          '/league'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      defaultTtl: -1 // No expiration
    }
    options: {
      throughput: 400
    }
  }
}

output cosmosDbEndpoint string = cosmosDbAccount.properties.documentEndpoint
output cosmosDbName string = cosmosDbAccount.name
output databaseName string = database.name
output picksContainerName string = picksContainer.name
output metricsContainerName string = metricsContainer.name

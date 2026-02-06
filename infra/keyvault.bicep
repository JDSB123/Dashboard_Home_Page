// ════════════════════════════════════════════════════════════════════════════
// GBSV Dashboard - Azure Key Vault Infrastructure
// ════════════════════════════════════════════════════════════════════════════
// Centralizes secrets management for all API keys, connection strings, and
// credentials used by Azure Functions and data pipelines.
// ════════════════════════════════════════════════════════════════════════════

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Azure region for Key Vault')
param location string = resourceGroup().location

@description('Object ID of the user or service principal that will manage secrets')
param adminObjectId string

@description('Object ID of the Azure Functions managed identity (for runtime access)')
param functionsIdentityObjectId string = ''

@description('Tenant ID for Azure AD')
param tenantId string = subscription().tenantId

// ════════════════════════════════════════════════════════════════════════════
// Variables
// ════════════════════════════════════════════════════════════════════════════

var keyVaultName = 'dashboard-gbsv-kv-${environment}'
var softDeleteRetentionDays = 7

// ════════════════════════════════════════════════════════════════════════════
// Key Vault Resource
// ════════════════════════════════════════════════════════════════════════════

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'premium' // Premium tier - HSM-backed keys, higher throughput
    }
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteRetentionDays
    enablePurgeProtection: true // Prevents permanent deletion
    enableRbacAuthorization: false // Using access policies
    accessPolicies: concat(
      [
        // Admin access - full control
        {
          tenantId: tenantId
          objectId: adminObjectId
          permissions: {
            secrets: [
              'get'
              'list'
              'set'
              'delete'
              'backup'
              'restore'
              'recover'
              'purge'
            ]
          }
        }
      ],
      functionsIdentityObjectId != ''
        ? [
            // Azure Functions runtime access - read-only
            {
              tenantId: tenantId
              objectId: functionsIdentityObjectId
              permissions: {
                secrets: [
                  'get'
                  'list'
                ]
              }
            }
          ]
        : []
    )
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
  tags: {
    environment: environment
    project: 'GBSV Dashboard'
    purpose: 'API keys and secrets management'
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Secret Placeholders (values set manually via Azure CLI or Portal)
// ════════════════════════════════════════════════════════════════════════════

// SportsDataIO API Key - for NFL/NCAAF box scores
resource secretSdio 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'sportsdataio-nfl-ncaaf'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'API Key'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'SportsDataIO'
    usage: 'NFL and NCAAF schedules, box scores'
  }
}

// The Odds API Key - for NBA/NCAAM odds
resource secretOddsApi 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'oddsapi-main'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'API Key'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'The Odds API'
    usage: 'NBA and NCAAM odds data'
  }
}

// Basketball API Key - secondary NBA/NCAAM source
resource secretBasketball 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'basketball-api'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'API Key'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Basketball API'
    usage: 'NBA and NCAAM secondary data'
  }
}

// Action Network credentials
resource secretActionNetworkUser 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'actionnetwork-user'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Username'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Action Network'
  }
}

resource secretActionNetworkPass 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'actionnetwork-password'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Password'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Action Network'
  }
}

// Azure Storage connection string - for blob archival
resource secretStorageConn 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-storage-connection-string'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Connection String'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Azure Storage'
    usage: 'Picks archival to blob storage'
  }
}

// Telegram Bot Token - for automatic pick extraction
resource secretTelegramBotToken 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'telegram-bot-token'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Bot Token'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Telegram'
    usage: 'TelegramRunner webhook verification and bot API'
  }
}

// Cosmos DB Endpoint
resource secretCosmosEndpoint 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-endpoint'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Endpoint URL'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Azure Cosmos DB'
    usage: 'Picks and metrics database endpoint'
  }
}

// Cosmos DB Primary Key
resource secretCosmosKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-key'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'API Key'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Azure Cosmos DB'
    usage: 'Picks and metrics database auth key'
  }
}

// Azure SignalR Connection String
resource secretSignalRConnection 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'signalr-connection-string'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Connection String'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Azure SignalR'
    usage: 'Real-time dashboard updates'
  }
}

// Sportsbook API Encryption Key (AES-256-GCM)
resource secretSportsbookEncryptionKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'sportsbook-encryption-key'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Encryption Key (64-char hex, generate: openssl rand -hex 32)'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'SportsbookAPI'
    usage: 'AES-256-GCM encryption for sportsbook credential transit'
  }
}

// Azure Computer Vision endpoint - for OCR
resource secretVisionEndpoint 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-vision-endpoint'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'Endpoint URL'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Azure Computer Vision'
    usage: 'OCR for bet slip images'
  }
}

// Azure Computer Vision key - for OCR
resource secretVisionKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-vision-key'
  properties: {
    value: 'PLACEHOLDER-SET-VIA-CLI'
    contentType: 'API Key'
    attributes: {
      enabled: true
    }
  }
  tags: {
    service: 'Azure Computer Vision'
    usage: 'OCR for bet slip images'
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Outputs
// ════════════════════════════════════════════════════════════════════════════

@description('Key Vault name')
output keyVaultName string = keyVault.name

@description('Key Vault resource ID')
output keyVaultId string = keyVault.id

@description('Key Vault URI for secret references')
output keyVaultUri string = keyVault.properties.vaultUri

@description('Secret URI references for Azure Functions app settings')
output secretReferences object = {
  sdioKey: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/sportsdataio-nfl-ncaaf/)'
  oddsApiKey: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/oddsapi-main/)'
  basketballApiKey: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/basketball-api/)'
  storageConnectionString: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/azure-storage-connection-string/)'
  visionEndpoint: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/azure-vision-endpoint/)'
  visionKey: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/azure-vision-key/)'
  telegramBotToken: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/telegram-bot-token/)'
  cosmosEndpoint: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/cosmos-endpoint/)'
  cosmosKey: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/cosmos-key/)'
  signalRConnectionString: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/signalr-connection-string/)'
  sportsbookEncryptionKey: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/sportsbook-encryption-key/)'
}

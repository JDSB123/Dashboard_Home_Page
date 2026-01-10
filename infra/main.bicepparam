using './main.bicep'

// ════════════════════════════════════════════════════════════════════════════
// GBSV Dashboard - Production Parameters
// ════════════════════════════════════════════════════════════════════════════

param environment = 'prod'
param location = 'global'
param customDomainName = 'www.greenbiersportventures.com'
param enableWaf = true
param skuName = 'Standard_AzureFrontDoor'

// Backend Origins - Current Container Apps
param staticWebAppHostname = 'proud-cliff-008e2e20f.2.azurestaticapps.net'
param orchestratorHostname = 'gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io'
param nbaApiHostname = 'nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io'
param ncaamApiHostname = 'ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io'
param nflApiHostname = 'nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io'
param ncaafApiHostname = 'ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'

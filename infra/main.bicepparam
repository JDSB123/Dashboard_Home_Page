using './main.bicep'

// ════════════════════════════════════════════════════════════════════════════
// GBSV Dashboard - Production Parameters
// ════════════════════════════════════════════════════════════════════════════

param environment = 'prod'
param location = 'global'
param enableWaf = true
param skuName = 'Standard_AzureFrontDoor'

// Backend Origins - Current Container Apps
param staticWebAppHostname = 'proud-cliff-008e2e20f.2.azurestaticapps.net'
param nbaApiHostname = 'nbagbsvv5-aca.blackglacier-f1574637.centralus.azurecontainerapps.io'
param ncaamApiHostname = 'ca-ncaamgbsvv20.braveriver-ed513377.eastus2.azurecontainerapps.io'
param nflApiHostname = 'nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io'
param ncaafApiHostname = 'ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'

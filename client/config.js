/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Dashboard_Home_Page - Production Runtime Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * Repository:  github.com/JDSB123/Dashboard_Home_Page
 * Azure RG:    Dashboard_Home_Page (eastus)
 * Owner:       jb@greenbiercapital.com
 * Version:     34.00.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Note: Object NOT frozen to allow dynamic endpoint updates from registry
window.APP_CONFIG = {
  // Project Identification
  PROJECT_NAME: 'Dashboard_Home_Page',
  VERSION: '34.00.0',
  ENVIRONMENT: 'production',

  // Azure Configuration
  AZURE_RESOURCE_GROUP: 'Dashboard_Home_Page',
  AZURE_REGION: 'eastus',

  // API Configuration
  API_BASE_URL: 'https://gbsv-orchestrator.azurewebsites.net/api',
  ORCHESTRATOR_URL: 'https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io',
  FUNCTIONS_BASE_URL: 'https://gbsv-orchestrator.azurewebsites.net',
  API_BASE_FALLBACK: '',

  // Model API Endpoints (can be dynamically updated by model-endpoints-bootstrap.js)
  // These endpoints are used by:
  //   - Frontend fetchers (nba-picks-fetcher.js, etc.) for real-time Weekly Lineup display
  //   - Azure Function ModelJobProcessor for backend async job processing
  //   - model-endpoints-bootstrap.js fetches latest from /api/registry on page load
  
  // NBA: Function App (primary) + Container App (fallback)
  NBA_FUNCTION_URL: 'https://nba-picks-trigger.azurewebsites.net',  // Primary - Function App with /api/weekly-lineup/nba
  NBA_API_URL: 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',  // Fallback - Container App
  NCAAM_API_URL: 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io',
  // NFL: Function App (primary) + Container App (fallback)
  NFL_FUNCTION_URL: 'https://nfl-picks-trigger.azurewebsites.net',  // Primary - Function App with /api/weekly-lineup/nfl
  NFL_API_URL: 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',  // Fallback - Container App
  NCAAF_API_URL: 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io',
  NHL_API_URL: '', // Placeholder - will be populated from registry when available
  MLB_API_URL: '', // Placeholder - will be populated from registry when available

  // Static Assets (Front Door / CDN)
  LOGO_BASE_URL: 'https://www.greenbiersportventures.com/team-logos', // Served via Front Door/custom domain
  LOGO_FALLBACK_URL: 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos', // Direct blob fallback

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Database Sync - Enable to sync picks with Azure Cosmos DB
  ENABLE_DB_SYNC: true,

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com',

  // Note: External API keys (SportsDataIO, TheOddsAPI) are configured in Azure Function App Settings
  // All external API calls are proxied through Azure Functions for security
};

// GBSV Configuration for Azure services
window.GBSV_CONFIG = {
  // Azure Functions URL for picks API and other backend services
  FUNCTIONS_URL: 'https://gbsv-orchestrator.azurewebsites.net',
  
  // Cosmos DB picks storage (accessed via Azure Functions)
  PICKS_API_ENDPOINT: 'https://gbsv-orchestrator.azurewebsites.net/api/picks'
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_CONFIG: window.APP_CONFIG, GBSV_CONFIG: window.GBSV_CONFIG };
}


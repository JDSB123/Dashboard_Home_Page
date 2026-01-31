/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Dashboard_Home_Page - Production Runtime Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * Repository:  github.com/JDSB123/Dashboard_Home_Page
 * Azure RG:    Dashboard_Home_Page (eastus)
 * Owner:       jb@greenbiercapital.com
 * Version:     34.00.1
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Note: Object NOT frozen to allow dynamic endpoint updates from registry
window.APP_CONFIG = {
  // Project Identification
  PROJECT_NAME: 'Dashboard_Home_Page',
  VERSION: '34.00.1',
  ENVIRONMENT: 'production',

  // Azure Configuration
  AZURE_RESOURCE_GROUP: 'dashboard-gbsv-main-rg',
  AZURE_REGION: 'eastus',

  // API Configuration
  API_BASE_URL: 'https://www.greenbiersportventures.com/api',
  ORCHESTRATOR_URL: 'https://www.greenbiersportventures.com/api',
  FUNCTIONS_BASE_URL: 'https://www.greenbiersportventures.com',
  API_BASE_FALLBACK: 'https://www.greenbiersportventures.com/api',
  DYNAMIC_REGISTRY_ENABLED: true,

  // Model API Endpoints (can be dynamically updated by model-endpoints-bootstrap.js)
  API_ENDPOINTS: {
    NFL: 'https://gbsv-orchestrator.azurewebsites.net/api/picks/nfl',
    NCAAF: 'https://gbsv-orchestrator.azurewebsites.net/api/picks/ncaaf',
    NBA: 'https://gbsvnbav2.nicedesert-7a4811c4.eastus.azurecontainerapps.io/picks',
    NCAAM: 'https://gbsv-orchestrator.azurewebsites.net/api/picks/ncaam',
    NHL: 'https://gbsv-orchestrator.azurewebsites.net/api/picks/nhl',
    MLB: 'https://gbsv-orchestrator.azurewebsites.net/api/picks/mlb'
  },

  // Feature Flags
  WEEKLY_LINEUP_DISABLED_LEAGUES: ['NFL', 'NCAAF'],

  // These endpoints are used by:
  //   - Frontend fetchers (nba-picks-fetcher.js, etc.) for real-time Weekly Lineup display
  //   - Azure Function ModelJobProcessor for backend async job processing
  //   - model-endpoints-bootstrap.js fetches latest from /api/registry on page load

  // NBA: Function App (primary) + Container App (fallback)
  NBA_FUNCTION_URL: 'https://www.greenbiersportventures.com/api/weekly-lineup/nba',  // Primary - Function App with /api/weekly-lineup/nba
  NBA_API_URL: 'https://gbsvnbav2.nicedesert-7a4811c4.eastus.azurecontainerapps.io',  // Fallback - v2 Container App
  NCAAM_API_URL: 'https://www.greenbiersportventures.com',
  // NFL: Function App (primary) + Container App (fallback)
  NFL_FUNCTION_URL: 'https://www.greenbiersportventures.com/api/weekly-lineup/nfl',  // Primary - Function App with /api/weekly-lineup/nfl
  NFL_API_URL: 'https://www.greenbiersportventures.com',  // Fallback - Front Door
  NCAAF_API_URL: 'https://www.greenbiersportventures.com',
  NHL_API_URL: '', // Placeholder - will be populated from registry when available
  MLB_API_URL: '', // Placeholder - will be populated from registry when available

  // Static Assets (Front Door / CDN)
  LOGO_BASE_URL: 'https://www.greenbiersportventures.com/team-logos', // Served via Front Door/custom domain
  LOGO_FALLBACK_URL: 'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos', // Direct blob fallback

  // Feature Flags
  WEEKLY_LINEUP_DISABLED_LEAGUES: ['NFL', 'NCAAF'],

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Database Sync - Enable to sync picks with Azure Cosmos DB
  ENABLE_DB_SYNC: true,
  // Team Records API (disable to avoid 404s when endpoint is unavailable)
  TEAM_RECORDS_API_ENABLED: false,

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com',

  // Note: External API keys (SportsDataIO, TheOddsAPI) are configured in Azure Function App Settings
  // All external API calls are proxied through Azure Functions for security
};

// Back-compat: some scripts read this directly
window.WEEKLY_LINEUP_DISABLED_LEAGUES = window.APP_CONFIG.WEEKLY_LINEUP_DISABLED_LEAGUES;

// GBSV Configuration for Azure services
window.GBSV_CONFIG = {
  // Azure Functions URL for picks API and other backend services
  FUNCTIONS_URL: 'https://www.greenbiersportventures.com',

  // Cosmos DB picks storage (accessed via Azure Functions)
  PICKS_API_ENDPOINT: 'https://gbsvnbav2.nicedesert-7a4811c4.eastus.azurecontainerapps.io/picks'
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_CONFIG: window.APP_CONFIG, GBSV_CONFIG: window.GBSV_CONFIG };
}

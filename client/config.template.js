/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Dashboard_Home_Page - Production Runtime Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * Repository:  github.com/JDSB123/Dashboard_Home_Page
 * Azure RG:    Dashboard_Home_Page (eastus)
 * Owner:       jb@greenbiercapital.com
 * Version:     33.01.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Note: Object NOT frozen to allow dynamic endpoint updates from registry
window.APP_CONFIG = {
  // Project Identification
  PROJECT_NAME: 'Dashboard_Home_Page',
  VERSION: '33.01.0',
  ENVIRONMENT: 'production',

  // Azure Configuration
  AZURE_RESOURCE_GROUP: 'Dashboard_Home_Page',
  AZURE_REGION: 'eastus',

  // API Configuration
  API_BASE_URL: '__API_BASE_URL__',
  ORCHESTRATOR_URL: '__ORCHESTRATOR_URL__',

  // Model API Endpoints (can be dynamically updated by model-endpoints-bootstrap.js)
  // These endpoints are used by:
  //   - Frontend fetchers (nba-picks-fetcher.js, etc.) for real-time Weekly Lineup display
  //   - Azure Function ModelJobProcessor for backend async job processing
  //   - model-endpoints-bootstrap.js fetches latest from /api/registry on page load
  
  // NBA: Function App (primary) + Container App (fallback)
  NBA_FUNCTION_URL: '__NBA_FUNCTION_URL__',  // Primary - Function App with /api/weekly-lineup/nba
  NBA_API_URL: '__NBA_API_URL__',  // Fallback - Container App
  NCAAM_API_URL: '__NCAAM_API_URL__',
  // NFL: Function App (primary) + Container App (fallback)
  NFL_FUNCTION_URL: '__NFL_FUNCTION_URL__',  // Primary - Function App with /api/weekly-lineup/nfl
  NFL_API_URL: '__NFL_API_URL__',  // Fallback - Container App
  NCAAF_API_URL: '__NCAAF_API_URL__',
  NHL_API_URL: '', // Placeholder - will be populated from registry when available
  MLB_API_URL: '', // Placeholder - will be populated from registry when available

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com',

  // Note: External API keys (SportsDataIO, TheOddsAPI) are configured in Azure Function App Settings
  // All external API calls are proxied through Azure Functions for security
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.APP_CONFIG;
}

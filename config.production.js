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

window.APP_CONFIG = Object.freeze({
  // Project Identification
  PROJECT_NAME: 'Dashboard_Home_Page',
  VERSION: '33.01.0',
  ENVIRONMENT: 'production',

  // Azure Configuration
  AZURE_RESOURCE_GROUP: 'Dashboard_Home_Page',
  AZURE_REGION: 'eastus',

  // API Configuration
  API_BASE_URL: 'https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io/api',

  // Model API Endpoints
  NBA_API_URL: 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
  NCAAM_API_URL: 'https://ncaam-stable-prediction.blackglacier-5fab3573.centralus.azurecontainerapps.io',
  NFL_API_URL: 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
  NCAAF_API_URL: 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io',

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com',

  // Note: External API keys (SportsDataIO, TheOddsAPI) are configured in Azure Function App Settings
  // All external API calls are proxied through Azure Functions for security
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.APP_CONFIG;
}

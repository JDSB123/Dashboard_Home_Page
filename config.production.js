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

  // API Configuration - All routed through main domain
  API_BASE_URL: 'https://www.greenbiersportventures.com/api',

  // Model API Endpoints - Proxied through main domain
  NBA_API_URL: 'https://www.greenbiersportventures.com/nba',
  NCAAM_API_URL: 'https://www.greenbiersportventures.com/ncaam',
  NFL_API_URL: 'https://www.greenbiersportventures.com/nfl',
  NCAAF_API_URL: 'https://www.greenbiersportventures.com/ncaaf',

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

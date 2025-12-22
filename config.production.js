/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Dashboard_Home_Page - Production Runtime Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * Repository:  github.com/JDSB123/Dashboard_Home_Page
 * Azure RG:    Dashboard_Home_Page (eastus)
 * Owner:       jb@greenbiercapital.com
 * Version:     4.2.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.APP_CONFIG = Object.freeze({
  // Project Identification
  PROJECT_NAME: 'Dashboard_Home_Page',
  VERSION: '4.2.0',
  ENVIRONMENT: 'production',

  // Azure Configuration
  AZURE_RESOURCE_GROUP: 'Dashboard_Home_Page',
  AZURE_REGION: 'eastus',

  // API Configuration
  API_BASE_URL: 'https://green-bier-picks-api.azurewebsites.net/api',

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com'

  // Note: External API keys (SportsDataIO, TheOddsAPI) are configured in Azure Function App Settings
  // All external API calls are proxied through Azure Functions for security
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.APP_CONFIG;
}

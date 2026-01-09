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
  API_BASE_URL: 'https://www.greenbiersportventures.com/api',
  ORCHESTRATOR_URL: 'https://www.greenbiersportventures.com',

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

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com',
};

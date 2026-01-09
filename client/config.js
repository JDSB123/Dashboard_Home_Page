/**
 * ════════════════════════════════════════════════════════════════════
 * Dashboard_Home_Page - Production Runtime Configuration
 * ════════════════════════════════════════════════════════════════════
 * Repository:  github.com/JDSB123/Dashboard_Home_Page
 * Azure RG:    Dashboard_Home_Page (eastus)
 * Owner:       jb@greenbiercapital.com
 * Version:     33.02.0
 * ════════════════════════════════════════════════════════════════════
 */

// Note: Object NOT frozen to allow dynamic endpoint updates from registry
window.APP_CONFIG = {
  // Project Identification
  PROJECT_NAME: 'Dashboard_Home_Page',
  VERSION: '33.02.0',
  ENVIRONMENT: 'production',

  // Azure Configuration
  AZURE_RESOURCE_GROUP: 'Dashboard_Home_Page',
  AZURE_REGION: 'eastus',

  // API Configuration - ALL APIs now use greenbiersportventures.com domain
  API_BASE_URL: 'https://www.greenbiersportventures.com/api',
  ORCHESTRATOR_URL: 'https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io',
  API_BASE_FALLBACK: 'https://www.greenbiersportventures.com/api',

  // Model API Endpoints - Use domain-based API proxy (Jan 2026)
  // All sports now route through www.greenbiersportventures.com/api/*
  NBA_FUNCTION_URL: '',  // Deprecated - use NBA_API_URL
  NBA_API_URL: 'https://www.greenbiersportventures.com/api',  // Primary - domain proxy to Container App
  NCAAM_API_URL: 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io',
  NFL_FUNCTION_URL: '',  // Deprecated
  NFL_API_URL: 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
  NCAAF_API_URL: 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io',
  NHL_API_URL: '',  // Placeholder
  MLB_API_URL: '',  // Placeholder

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com',
};

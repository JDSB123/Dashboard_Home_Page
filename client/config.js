/**
 * ════════════════════════════════════════════════════════════════════
 * Dashboard_Home_Page - Production Runtime Configuration
 * ════════════════════════════════════════════════════════════════════
 * Repository:  github.com/JDSB123/Dashboard_Home_Page
 * Azure RG:    dashboard-gbsv-main-rg (eastus)
 * Owner:       jb@greenbiercapital.com
 * Version:     34.01.0
 * ════════════════════════════════════════════════════════════════════
 * 
 * ROUTING ARCHITECTURE (Azure Front Door):
 * ────────────────────────────────────────
 * All API traffic routes through Front Door for:
 *   - Global CDN edge caching
 *   - WAF protection
 *   - Path-based routing to Container Apps
 *   - Single unified domain
 * 
 * Path Routing:
 *   /api/nba/*    → NBA Container App
 *   /api/ncaam/*  → NCAAM Container App
 *   /api/nfl/*    → NFL Container App
 *   /api/ncaaf/*  → NCAAF Container App
 *   /api/*        → Orchestrator (fallback)
 *   /*            → Static Web App (dashboard)
 * ════════════════════════════════════════════════════════════════════
 */

// Note: Object NOT frozen to allow dynamic endpoint updates from registry
window.APP_CONFIG = {
  // Project Identification
  PROJECT_NAME: 'Dashboard_Home_Page',
  VERSION: '34.01.0',
  ENVIRONMENT: 'production',

  // Azure Configuration
  AZURE_RESOURCE_GROUP: 'dashboard-gbsv-main-rg',
  AZURE_REGION: 'eastus',

  // ═══════════════════════════════════════════════════════════════════
  // FRONT DOOR ROUTING CONFIGURATION
  // All APIs routed through Azure Front Door with path-based routing
  // ═══════════════════════════════════════════════════════════════════
  
  // Primary API endpoint (Front Door) - Production Only
  API_BASE_URL: 'https://www.greenbiersportventures.com/api',
  
  // Fallback: Orchestrator direct URL (must be HTTPS for CSP compliance)
  ORCHESTRATOR_URL: 'https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io',
  API_BASE_FALLBACK: 'https://gbsv-orchestrator.wittypebble-41c11c65.eastus.azurecontainerapps.io/api',

  // Azure Functions URL (for registry, SignalR negotiate, etc.)
  FUNCTIONS_BASE_URL: 'https://gbsv-orchestrator.azurewebsites.net',

  // ═══════════════════════════════════════════════════════════════════
  // SPORT-SPECIFIC API ENDPOINTS
  // Primary: Front Door path-based routing (unified domain)
  // Direct: Container App URLs (for fallback/debugging)
  // ═══════════════════════════════════════════════════════════════════
  
  // NBA API
  NBA_API_URL: 'https://www.greenbiersportventures.com/api/nba',
  NBA_API_DIRECT: 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
  NBA_FUNCTION_URL: '',  // Deprecated
  
  // NCAAM API
  NCAAM_API_URL: 'https://www.greenbiersportventures.com/api/ncaam',
  NCAAM_API_DIRECT: 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io',
  
  // NFL API
  NFL_API_URL: 'https://www.greenbiersportventures.com/api/nfl',
  NFL_API_DIRECT: 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
  NFL_FUNCTION_URL: '',  // Deprecated
  
  // NCAAF API
  NCAAF_API_URL: 'https://www.greenbiersportventures.com/api/ncaaf',
  NCAAF_API_DIRECT: 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io',
  
  // Future sports (placeholders)
  NHL_API_URL: '',
  MLB_API_URL: '',

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,
  USE_FRONT_DOOR: true,  // Toggle to use Front Door vs direct Container App URLs
  ENABLE_DB_SYNC: false, // Set to false to disable fetching from non-existent Orchestrator endpoints (get-picks, team-records)
  SIGNALR_ENABLED: true, // Azure SignalR Service is deployed and configured
  DYNAMIC_REGISTRY_ENABLED: true, // Azure Functions deployed with ModelRegistry

  // Repository Info
  REPO_URL: 'https://github.com/JDSB123/Dashboard_Home_Page',
  OWNER: 'jb@greenbiercapital.com',
};

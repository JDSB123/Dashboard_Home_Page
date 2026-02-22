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
  PROJECT_NAME: "Dashboard_Home_Page",
  VERSION: "34.00.1",
  ENVIRONMENT: "production",

  // Azure Configuration
  AZURE_RESOURCE_GROUP: "dashboard-gbsv-main-rg",
  AZURE_REGION: "eastus",

  // API Configuration
  API_BASE_URL: "https://www.greenbiersportventures.com/api",
  ORCHESTRATOR_URL: "https://www.greenbiersportventures.com/api",
  FUNCTIONS_BASE_URL: "https://www.greenbiersportventures.com",
  API_BASE_FALLBACK: "https://www.greenbiersportventures.com/api",
  DYNAMIC_REGISTRY_ENABLED: true,

  // Model API Endpoints — sport models removed; endpoints live in their own repos
  // Direct Container App fallbacks (used only if Front Door route fails)
  NBA_API_URL:
    "https://nbagbsvv5-aca.blackglacier-f1574637.centralus.azurecontainerapps.io",
  NCAAM_API_URL:
    "https://ca-ncaamgbsvv20.braveriver-ed513377.eastus2.azurecontainerapps.io",

  // Static Assets (Front Door / CDN)
  LOGO_BASE_URL: "https://www.greenbiersportventures.com/team-logos", // Served via Front Door/custom domain
  LOGO_FALLBACK_URL:
    "https://gbsvorchestratorstorage.blob.core.windows.net/team-logos", // Direct blob fallback

  // Feature Flags
  AUTH_ENABLED: false,
  DEBUG_MODE: false,

  // Database Sync - Enable to sync picks with Azure Cosmos DB
  ENABLE_DB_SYNC: true,
  // Team Records API (disable to avoid 404s when endpoint is unavailable)
  TEAM_RECORDS_API_ENABLED: false,

  // Repository Info
  REPO_URL: "https://github.com/JDSB123/Dashboard_Home_Page",
  OWNER: "jb@greenbiercapital.com",

  // Note: External API keys (SportsDataIO, TheOddsAPI) are configured in Azure Function App Settings
  // All external API calls are proxied through Azure Functions for security
};

// Back-compat: some scripts read this directly
window.WEEKLY_LINEUP_DISABLED_LEAGUES =
  window.APP_CONFIG.WEEKLY_LINEUP_DISABLED_LEAGUES;

// GBSV Configuration for Azure services
window.GBSV_CONFIG = {
  // Azure Functions URL for picks API and other backend services
  FUNCTIONS_URL: "https://www.greenbiersportventures.com",

  // Cosmos DB picks storage (accessed via Azure Functions)
  PICKS_API_ENDPOINT: "https://www.greenbiersportventures.com/nba/picks",
};

// ── Local Development Override ──────────────────────────────────────────
// When served from localhost / 127.0.0.1 (e.g. VS Code Live Server),
// point API calls at the local Azure Functions host so CORS is not an issue.
(function () {
  if (typeof window === "undefined") return;
  const loc = window.location;
  const isLocal =
    loc.hostname === "localhost" ||
    loc.hostname === "127.0.0.1" ||
    loc.hostname === "0.0.0.0";
  if (!isLocal) return;

  // Default local Functions port configured in local.settings.json
  const LOCAL_API = "http://localhost:7072/api";
  const LOCAL_BASE = "http://localhost:7072";

  window.APP_CONFIG.ENVIRONMENT = "development";
  window.APP_CONFIG.API_BASE_URL = LOCAL_API;
  window.APP_CONFIG.ORCHESTRATOR_URL = LOCAL_API;
  window.APP_CONFIG.FUNCTIONS_BASE_URL = LOCAL_BASE;
  window.APP_CONFIG.API_BASE_FALLBACK = LOCAL_API;

  window.GBSV_CONFIG.FUNCTIONS_URL = LOCAL_BASE;
  window.GBSV_CONFIG.PICKS_API_ENDPOINT = LOCAL_BASE + "/nba/picks";
})();

// Export for module usage if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    APP_CONFIG: window.APP_CONFIG,
    GBSV_CONFIG: window.GBSV_CONFIG,
  };
}

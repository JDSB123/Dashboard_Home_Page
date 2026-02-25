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

  // Model API Endpoints (can be dynamically updated by model-endpoints-bootstrap.js)
  API_ENDPOINTS: {
    NFL: "__NFL_API_URL__",
    NCAAF: "__NCAAF_API_URL__",
    NBA: "__NBA_API_URL__",
    NCAAM: "__NCAAM_API_URL__",
    NHL: "",
    MLB: "",
  },

  // Feature Flags
  WEEKLY_LINEUP_DISABLED_LEAGUES: ["NFL", "NCAAF"],

  // These endpoints are used by:
  //   - Frontend fetchers (nba-picks-fetcher.js, etc.) for real-time Weekly Lineup display
  //   - Azure Function ModelJobProcessor for backend async job processing
  //   - model-endpoints-bootstrap.js fetches latest from /api/registry on page load

  // Sport Prediction APIs - Direct routing via Front Door: /{sport}/predictions
  NBA_API_URL: "__NBA_API_URL__",
  NCAAM_API_URL: "__NCAAM_API_URL__",
  NFL_API_URL: "__NFL_API_URL__",
  NCAAF_API_URL: "__NCAAF_API_URL__",
  NHL_API_URL: "",
  MLB_API_URL: "",

  // Static Assets (Front Door / CDN)
  LOGO_BASE_URL: "__LOGO_BASE_URL__",
  LOGO_PRIMARY_URL: "__LOGO_BASE_URL__",
  LOGO_FALLBACK_URL: "__LOGO_FALLBACK_URL__",

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
  FUNCTIONS_URL: "https://www.greenbiersportventures.com",
  PICKS_API_ENDPOINT: "https://www.greenbiersportventures.com/nba/picks",
};

// ── Logo Host Auto Failover / Switchback ───────────────────────────────
// Default to fallback immediately to avoid broken logo renders,
// then promote back to primary host when a probe succeeds.
(function () {
  if (typeof window === "undefined" || !window.APP_CONFIG) return;

  const cfg = window.APP_CONFIG;
  const primary = (cfg.LOGO_PRIMARY_URL || cfg.LOGO_BASE_URL || "").replace(
    /\/$/,
    "",
  );
  const fallback = (cfg.LOGO_FALLBACK_URL || "").replace(/\/$/, "");

  if (!primary || !fallback || primary === fallback) return;

  cfg.LOGO_BASE_URL = fallback;
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[LogoHost] failover active -> ${fallback}`);
  }

  const probe = new Image();
  let settled = false;
  const timeout = setTimeout(() => {
    if (!settled) settled = true;
  }, 2500);

  probe.onload = function () {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    cfg.LOGO_BASE_URL = primary;
    if (typeof console !== "undefined" && typeof console.info === "function") {
      console.info(`[LogoHost] primary restored -> ${primary}`);
    }
  };

  probe.onerror = function () {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
  };

  probe.src = `${primary}/leagues-500-nba.png?probe=${Date.now()}`;
})();

// Export for module usage if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    APP_CONFIG: window.APP_CONFIG,
    GBSV_CONFIG: window.GBSV_CONFIG,
  };
}

// Production runtime configuration for dashboard v4.2
// API keys are stored in Azure Function App Settings (server-side only)
window.APP_CONFIG = Object.freeze({
  API_BASE_URL: 'https://green-bier-picks-api.azurewebsites.net/api',
  AUTH_ENABLED: false,
  DEBUG_MODE: false
  // Note: External API keys (SportsDataIO, TheOddsAPI) are configured in Azure Function App Settings
  // All external API calls are proxied through Azure Functions for security
});

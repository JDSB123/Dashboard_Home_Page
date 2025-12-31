/**
 * Fetch model endpoints from the orchestrator registry so front-end stays in sync
 * with updated Azure Container App URLs without redeploying static assets.
 *
 * Supports dynamic discovery of new leagues - any key in the registry with an
 * 'endpoint' property will be added to APP_CONFIG as {KEY}_API_URL.
 */
(function() {
    'use strict';

    const REGISTRY_TIMEOUT_MS = 6000;

    // Known leagues to look for (can be extended by registry response)
    const KNOWN_LEAGUES = ['nba', 'ncaam', 'nfl', 'ncaaf', 'nhl', 'mlb'];

    const fetchWithTimeout = async (url, timeoutMs = REGISTRY_TIMEOUT_MS) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
            clearTimeout(timer);
            return response;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    };

    const hydrateEndpoints = async () => {
        const baseUrl = window.APP_CONFIG?.API_BASE_URL;
        if (!baseUrl) return;

        const url = `${baseUrl}/registry`;

        try {
            const res = await fetchWithTimeout(url);
            if (!res.ok) throw new Error(`Registry request failed: ${res.status}`);
            const registry = await res.json();

            // Dynamically iterate over ALL keys in registry response
            // This allows new leagues/models to be added without code changes
            const registryKeys = Object.keys(registry || {});
            const allLeagues = [...new Set([...KNOWN_LEAGUES, ...registryKeys])];

            let updatedCount = 0;
            allLeagues.forEach((key) => {
                const entry = registry?.[key];
                if (entry?.endpoint) {
                    const configKey = `${key.toUpperCase()}_API_URL`;
                    window.APP_CONFIG[configKey] = entry.endpoint;
                    updatedCount++;
                    console.log(`[MODEL-ENDPOINTS] Updated ${configKey}: ${entry.endpoint}`);
                }
            });

            window.APP_CONFIG.MODEL_ENDPOINTS_LAST_UPDATED = new Date().toISOString();
            window.APP_CONFIG.MODEL_ENDPOINTS_COUNT = updatedCount;

            if (updatedCount > 0) {
                console.log(`[MODEL-ENDPOINTS] Hydrated ${updatedCount} endpoints from registry`);
            }
        } catch (err) {
            // Safe to continue; pick fetchers will fall back to current APP_CONFIG values
            console.warn('[MODEL-ENDPOINTS] Unable to refresh endpoints from registry:', err.message);
        }
    };

    // Kick off hydration early so downstream fetchers use fresh endpoints
    hydrateEndpoints();

    // Expose for optional manual refresh/debug
    window.ModelEndpointBootstrap = {
        hydrate: hydrateEndpoints,
        getKnownLeagues: () => KNOWN_LEAGUES
    };
})();

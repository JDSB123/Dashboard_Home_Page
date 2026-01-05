/**
 * Fetch model endpoints from the orchestrator registry so front-end stays in sync
 * with updated Azure Container App URLs without redeploying static assets.
 */
(function() {
    'use strict';

    const REGISTRY_TIMEOUT_MS = 6000;

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
        if (!baseUrl) {
            console.warn('[MODEL-ENDPOINTS] API_BASE_URL not configured, skipping registry fetch');
            return;
        }

        const url = `${baseUrl}/registry`;
        console.log('[MODEL-ENDPOINTS] Fetching model endpoints from registry:', url);

        try {
            const res = await fetchWithTimeout(url);
            if (!res.ok) throw new Error(`Registry request failed: ${res.status}`);
            const registry = await res.json();

            let updatedCount = 0;
            ['nba', 'ncaam', 'nfl', 'ncaaf'].forEach((key) => {
                const entry = registry?.[key];
                if (entry?.endpoint) {
                    const configKey = `${key.toUpperCase()}_API_URL`;
                    const oldEndpoint = window.APP_CONFIG[configKey];
                    window.APP_CONFIG[configKey] = entry.endpoint;
                    updatedCount++;
                    if (oldEndpoint !== entry.endpoint) {
                        console.log(`[MODEL-ENDPOINTS] Updated ${key.toUpperCase()} endpoint: ${entry.endpoint}`);
                    }
                }
            });

            window.APP_CONFIG.MODEL_ENDPOINTS_LAST_UPDATED = new Date().toISOString();
            console.log(`[MODEL-ENDPOINTS] ✅ Registry hydration complete - ${updatedCount} endpoints updated`);
        } catch (err) {
            // Safe to continue; pick fetchers will fall back to current APP_CONFIG values
            console.warn('[MODEL-ENDPOINTS] Unable to refresh endpoints from registry:', err.message);
            console.warn('[MODEL-ENDPOINTS] Fetchers will use fallback endpoints from config.production.js');
        }
    };

    // Kick off hydration early so downstream fetchers use fresh endpoints
    hydrateEndpoints();

    // Expose for optional manual refresh/debug
    window.ModelEndpointBootstrap = {
        hydrate: hydrateEndpoints
    };
})();

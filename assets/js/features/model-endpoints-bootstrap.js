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
        if (!baseUrl) return;

        const url = `${baseUrl}/registry`;

        try {
            const res = await fetchWithTimeout(url);
            if (!res.ok) throw new Error(`Registry request failed: ${res.status}`);
            const registry = await res.json();

            ['nba', 'ncaam', 'nfl', 'ncaaf'].forEach((key) => {
                const entry = registry?.[key];
                if (entry?.endpoint) {
                    window.APP_CONFIG[`${key.toUpperCase()}_API_URL`] = entry.endpoint;
                }
            });

            window.APP_CONFIG.MODEL_ENDPOINTS_LAST_UPDATED = new Date().toISOString();
        } catch (err) {
            // Safe to continue; pick fetchers will fall back to current APP_CONFIG values
            console.warn('[MODEL-ENDPOINTS] Unable to refresh endpoints from registry:', err.message);
        }
    };

    // Kick off hydration early so downstream fetchers use fresh endpoints
    hydrateEndpoints();

    // Expose for optional manual refresh/debug
    window.ModelEndpointBootstrap = {
        hydrate: hydrateEndpoints
    };
})();

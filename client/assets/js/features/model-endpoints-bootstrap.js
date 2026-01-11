/**
 * Model Endpoints Bootstrap v34.00.0
 * 
 * PURPOSE:
 * Fetch model endpoints from the orchestrator registry so front-end stays in sync
 * with updated Azure Container App URLs without redeploying static assets.
 *
 * EXECUTION ORDER:
 * 1. Runs IMMEDIATELY at page load (not deferred)
 * 2. Fetches /api/registry with 6-second timeout
 * 3. Updates APP_CONFIG.{NBA|NCAAM|NFL|NCAAF}_API_URL dynamically
 * 4. Falls back to config.js defaults if registry unavailable
 * 
 * RELATIONSHIP WITH model-endpoint-resolver.js:
 * - Bootstrap UPDATES APP_CONFIG at page load
 * - Resolver READS FROM APP_CONFIG when fetchers need endpoints
 * - Together they enable zero-downtime Container App updates
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
        // Check if dynamic registry is enabled - if not, skip network calls entirely
        if (!window.APP_CONFIG?.DYNAMIC_REGISTRY_ENABLED) {
            console.log('[MODEL-ENDPOINTS] Dynamic registry disabled - using static config.js endpoints');
            console.log('[MODEL-ENDPOINTS] • To enable dynamic registry, set DYNAMIC_REGISTRY_ENABLED: true in config.js');
            console.log('[MODEL-ENDPOINTS] • Requires Azure Functions deployment with ModelRegistry function');
            window.APP_CONFIG.MODEL_ENDPOINTS_SOURCE = 'static';
            window.APP_CONFIG.MODEL_ENDPOINTS_LAST_UPDATED = new Date().toISOString();
            return;
        }

        const primaryBase = window.APP_CONFIG?.API_BASE_URL;
        const fallbackBase = window.APP_CONFIG?.API_BASE_FALLBACK;
        const functionsBase = window.APP_CONFIG?.FUNCTIONS_BASE_URL;

        const resolveRegistry = async (base) => {
            if (!base) return null;
            const url = `${base}/registry`;
            console.log('[MODEL-ENDPOINTS] Fetching model endpoints from registry:', url);
            const res = await fetchWithTimeout(url);
            if (!res.ok) throw new Error(`Registry request failed: ${res.status}`);
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (!ct.includes('application/json')) {
                // Likely a SPA HTML fallback; treat as failure so we try the fallback base
                throw new Error(`Unexpected content-type: ${ct}`);
            }
            return await res.json();
        };

        let registry = null;
        const sources = [
            { name: 'primary', base: primaryBase },
            { name: 'fallback', base: fallbackBase },
            { name: 'functions', base: functionsBase ? `${functionsBase}/api` : null }
        ].filter(s => s.base);

        for (const source of sources) {
            try {
                registry = await resolveRegistry(source.base);
                if (registry) {
                    console.log(`[MODEL-ENDPOINTS] • Registry loaded from ${source.name}`);
                    break;
                }
            } catch (err) {
                console.warn(`[MODEL-ENDPOINTS] ${source.name} registry fetch failed:`, err.message);
            }
        }

        if (!registry) {
            console.warn('[MODEL-ENDPOINTS] Unable to refresh endpoints from registry (all sources failed)');
            console.log('[MODEL-ENDPOINTS] • Using fallback endpoints from config.js');
            console.log('[MODEL-ENDPOINTS] • Consider setting DYNAMIC_REGISTRY_ENABLED: false if registry not deployed');
            window.APP_CONFIG.MODEL_ENDPOINTS_SOURCE = 'static-fallback';
            return;
        }

        // Dynamically iterate over ALL keys in registry response
        // This allows new leagues/models to be added without code changes
        const registryKeys = Object.keys(registry || {});
        const allLeagues = [...new Set([...KNOWN_LEAGUES, ...registryKeys])];

        let updatedCount = 0;
        allLeagues.forEach((key) => {
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
        window.APP_CONFIG.MODEL_ENDPOINTS_COUNT = updatedCount;
        window.APP_CONFIG.MODEL_ENDPOINTS_SOURCE = 'registry';

        if (updatedCount > 0) {
            console.log(`[MODEL-ENDPOINTS] Hydrated ${updatedCount} endpoints from registry`);
        }
        console.log(`[MODEL-ENDPOINTS] • Registry hydration complete - ${updatedCount} endpoints updated`);
    };

    // Kick off hydration early so downstream fetchers use fresh endpoints
    hydrateEndpoints();

    // Expose for optional manual refresh/debug
    window.ModelEndpointBootstrap = {
        hydrate: hydrateEndpoints,
        getKnownLeagues: () => KNOWN_LEAGUES
    };
})();

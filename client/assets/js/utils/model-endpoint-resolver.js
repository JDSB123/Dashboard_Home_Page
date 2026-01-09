/**
 * Model Endpoint Resolver
 * - Centralizes how front-end fetchers resolve model endpoints (API + Function)
 * - Reads dynamic registry values hydrated by model-endpoints-bootstrap.js
 * - Falls back to sane defaults so missing config never breaks fetching
 */
(function() {
    'use strict';

    const DEFAULTS = {
        nba: {
            api: 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io',
            func: 'https://nba-picks-trigger.azurewebsites.net'
        },
        ncaam: {
            api: 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io'
        },
        nfl: {
            api: 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io',
            func: 'https://nfl-picks-trigger.azurewebsites.net'
        },
        ncaaf: {
            api: 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io'
        }
    };

    const normKey = (league) => String(league || '').toLowerCase();

    const getApiEndpoint = (league) => {
        const key = normKey(league);
        const configKey = `${key.toUpperCase()}_API_URL`;
        const fromConfig = window.APP_CONFIG?.[configKey];
        if (fromConfig && typeof fromConfig === 'string') return fromConfig;
        return DEFAULTS[key]?.api || '';
    };

    const getFunctionEndpoint = (league) => {
        const key = normKey(league);
        const configKey = `${key.toUpperCase()}_FUNCTION_URL`;
        const fromConfig = window.APP_CONFIG?.[configKey];
        if (fromConfig && typeof fromConfig === 'string') return fromConfig;
        return DEFAULTS[key]?.func || '';
    };

    const ensureRegistryHydrated = async () => {
        if (window.ModelEndpointBootstrap?.hydrate) {
            try {
                await window.ModelEndpointBootstrap.hydrate();
            } catch (err) {
                // Safe to ignore; defaults will be used.
                console.warn('[MODEL-ENDPOINT-RESOLVER] Registry hydrate failed:', err.message);
            }
        }
    };

    window.ModelEndpointResolver = {
        getApiEndpoint,
        getFunctionEndpoint,
        ensureRegistryHydrated
    };
})();


/**
 * NBA Picks Fetcher v2.0
 * Fetches NBA model picks via domain-based API proxy
 * 
 * Endpoint: https://www.greenbiersportventures.com/api/*
 * All API calls now route through the main domain (Jan 2026)
 */

(function() {
    'use strict';

    // Primary API endpoint - uses domain proxy
    const getApiEndpoint = () => 
        (window.ModelEndpointResolver?.getApiEndpoint('nba')) ||
        window.APP_CONFIG?.NBA_API_URL ||
        'https://www.greenbiersportventures.com/api';

    const NBA_API_URL = getApiEndpoint();

    let picksCache = null;
    let lastFetch = null;
    let lastSource = null;
    const CACHE_DURATION = 60000; // 1 minute
    const REQUEST_TIMEOUT = 60000; // 60 seconds

    /**
     * Fetch with timeout
     */
    async function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(Request timed out after ${timeoutMs}ms);
            }
            throw error;
        }
    }

    const getCacheKey = (date) => (date || 'today').toString().trim().toLowerCase() || 'today';

    /**
     * Fetch NBA picks for a given date
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Picks data
     */
    async function fetchNBAPicks(date = 'today') {
        if (window.ModelEndpointResolver?.ensureRegistryHydrated) {
            window.ModelEndpointResolver.ensureRegistryHydrated();
        }

        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log([NBA-PICKS] Using cached picks (source: ${lastSource}));
            return picksCache;
        }

        const apiUrl = getApiEndpoint();
        const url = \/slate/${date}/executive;
        console.log([NBA-PICKS] Fetching from: ${url});

        try {
            const response = await fetchWithTimeout(url);
            if (!response.ok) {
                throw new Error(API error: ${response.status});
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();
            lastSource = 'domain-proxy';
            console.log([NBA-PICKS] ✅ Returned ${data.total_plays || 0} picks);
            return data;
        } catch (error) {
            console.error('[NBA-PICKS] Fetch failed:', error.message);
            throw error;
        }
    }

    /**
     * Fetch weekly lineup data (JSON format for website display)
     * @param {string} date - Optional date parameter
     * @returns {Promise<Object>} Weekly lineup data
     */
    async function fetchWeeklyLineup(date = 'today') {
        const apiUrl = getApiEndpoint();
        const url = \/weekly-lineup/nba${date !== 'today' ? ?date=${date}` : ''};
        console.log([NBA-PICKS] Fetching weekly lineup from: ${url});

        try {
            const response = await fetchWithTimeout(url);
            if (!response.ok) {
                throw new Error(API error: ${response.status});
            }
            return await response.json();
        } catch (error) {
            console.error('[NBA-PICKS] Weekly lineup fetch failed:', error.message);
            throw error;
        }
    }

    /**
     * Fetch full slate analysis
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Full slate data
     */
    async function fetchFullSlate(date = 'today') {
        const apiUrl = getApiEndpoint();
        const url = \/slate/${encodeURIComponent(date)}`;
        console.log([NBA-PICKS] Fetching full slate from: ${url});

        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(NBA API error: ${response.status});
            }
            return await response.json();
        } catch (error) {
            console.error('[NBA-PICKS] Full slate fetch failed:', error.message);
            throw error;
        }
    }

    /**
     * Clear the picks cache
     */
    function clearCache() {
        picksCache = null;
        lastFetch = null;
        lastSource = null;
        console.log('[NBA-PICKS] Cache cleared');
    }

    /**
     * Get cache status
     */
    function getCacheStatus() {
        return {
            cached: !!picksCache,
            lastFetch: lastFetch ? new Date(lastFetch).toISOString() : null,
            source: lastSource,
            age: lastFetch ? Date.now() - lastFetch : null
        };
    }

    // Export to window
    window.NBAPicks = {
        fetch: fetchNBAPicks,
        fetchWeeklyLineup,
        fetchFullSlate,
        clearCache,
        getCacheStatus,
        getApiEndpoint
    };

    console.log('[NBA-PICKS] v2.0 loaded - using domain proxy: www.greenbiersportventures.com/api');
})();

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
                throw new Error(`Request timed out after ${timeoutMs}ms`);
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
        const NBA_API_URL = getApiEndpoint();
        const cacheKey = getCacheKey(date);

        // Check cache for today's data
        if (date === 'today' && picksCache && lastFetch) {
            const now = new Date().getTime();
            if (now - lastFetch < CACHE_DURATION) {
                console.log('[NBA-FETCHER] Returning cached picks');
                return { success: true, data: picksCache, source: 'cache' };
            }
        }

        try {
            // Updated Endpoint Structure for backend Proxy
            // The backend expects /api/v1/picks?date=... or /api/v1/picks/{date}
            let endpoint = `${NBA_API_URL}/v1/picks`;
            
            // Handle date parameter
            if (date && date !== 'today') {
                endpoint += `?date=${encodeURIComponent(date)}`;
            } else if (date === 'today') {
                 endpoint += `?date=today`;
            }

            console.log(`[NBA-FETCHER] Fetching from: ${endpoint}`);

            const response = await fetchWithTimeout(endpoint);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response structure
            if (!data || (!data.data && !Array.isArray(data))) {
                console.warn('[NBA-FETCHER] Unexpected response format', data);
            }

            // Cache if it's today's data
            if (date === 'today') {
                picksCache = data;
                lastFetch = new Date().getTime();
                lastSource = 'api';
            }

            return { success: true, data: data, source: 'api' };

        } catch (error) {
            console.error('[NBA-FETCHER] Fetch failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Expose via global window object
    window.NBAPicksFetcher = {
        fetchNBAPicks,
        clearCache: () => {
            picksCache = null;
            lastFetch = null;
            console.log('[NBA-FETCHER] Cache cleared');
        }
    };

    console.log('[NBA-FETCHER] v2.0 loaded - Domain Proxy Mode');

})();

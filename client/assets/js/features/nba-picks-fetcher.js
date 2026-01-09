/**
 * NBA Picks Fetcher v2.1
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

        // Check cache for today's data (only for 'today' queries)
        if (date === 'today' && picksCache && lastFetch) {
            const now = new Date().getTime();
            if (now - lastFetch < CACHE_DURATION) {
                console.log('[NBA-FETCHER] Returning cached picks');
                return { success: true, data: picksCache, source: 'cache' };
            }
        }

        try {
            // Updated Endpoint Structure for backend Proxy
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
                // Determine if 404 means no games or bad endpoint
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response structure
            if (!data || (!data.data && !Array.isArray(data) && !data.plays)) {
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
            // Return failure object that unified fetcher understands
            return { success: false, error: error.message };
        }
    }

    /**
     * Formats a raw API play object into the standard table format
     * @param {Object} play - Raw play object from API
     * @returns {Object} Formatted pick object
     */
    function formatPickForTable(play) {
        if (!play) return null;

        const home = play.home_team || play.home || 'Unknown';
        const away = play.away_team || play.away || 'Unknown';
        const matchup = `${away} @ ${home}`;
        
        // Determine pick display text
        let pickText = play.selection || play.feature_name || play.model_feature || 'N/A';
        // Cleanup pick text if it's too raw (e.g. "home_spread_-5.5" -> "Home -5.5")
        if (pickText && typeof pickText === 'string') {
            pickText = pickText.replace(/_/g, ' ');
        }

        return {
            sport: 'NBA',
            matchup: matchup,
            market: play.market || play.bet_type || 'General',
            pick: pickText,
            odds: play.odds_available || play.price || play.odds || -110,
            units: play.units || (play.kelly_fraction ? (play.kelly_fraction * 10).toFixed(2) : '1.0'),
            confidence: play.confidence || 'Norm',
            ev: play.ev ? `${(play.ev * 100).toFixed(1)}%` : '0%',
            sportsbook: play.sportsbook || 'Any',
            startTime: play.game_date || play.date || new Date().toISOString(),
            raw: play // Keep raw data for details view
        };
    }

    /**
     * Checks if the API is reachable
     * @returns {Promise<boolean>}
     */
    async function checkHealth() {
        try {
            const NBA_API_URL = getApiEndpoint();
            // Try hitting base health endpoint if v1/picks is heavyweight
            // Usually /health or /api/health check
            const response = await fetchWithTimeout(`${NBA_API_URL}/health`, 5000);
            return response.ok;
        } catch (e) {
            console.warn('[NBA-FETCHER] Health check failed:', e);
            return false;
        }
    }

    // Expose via global window object
    window.NBAPicksFetcher = {
        fetchNBAPicks,
        fetchPicks: fetchNBAPicks, // Alias for unified fetcher
        formatPickForTable,
        checkHealth,
        clearCache: () => {
            picksCache = null;
            lastFetch = null;
            console.log('[NBA-FETCHER] Cache cleared');
        }
    };

    console.log('[NBA-FETCHER] v2.1 loaded - Domain Proxy Mode with Unified Interface');

})();

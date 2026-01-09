/**
 * NBA Picks Fetcher v2.2
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
            // The backend serves picks at /weekly-lineup/nba, not /v1/picks
            let endpoint = `${NBA_API_URL}/weekly-lineup/nba`;
            
            // Handle date parameter
            // Note: /weekly-lineup/nba currently relies on backend calculating 'latest' or today
            // If the backend supports ?date=..., we append it. It is mostly auto-determined.
            // Based on previous analysis, we will rely on default backend behavior for 'today'.
            
            if (date && date !== 'today') {
                 // Warning: Backend might not support arbitrary dates on this specific endpoint
                 // But we pass it just in case logic updates
                 endpoint += `?date=${encodeURIComponent(date)}`;
            }

            console.log(`[NBA-FETCHER] Fetching from: ${endpoint}`);

            const response = await fetchWithTimeout(endpoint);

            if (!response.ok) {
                // Try alternate endpoint if first fails, or just throw
                 // Maybe fallback to v1/picks? No, that was 404.
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response structure
            if (!data || (!data.data && !Array.isArray(data) && !data.plays && !data.picks)) {
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

        // Ensure we handle both "picks" array items and "plays" array items if format differs
        // Backend /weekly-lineup/nba returns { picks: [...] }

        const home = play.home_team || play.home || 'Unknown';
        const away = play.away_team || play.away || 'Unknown';
        
        // Sometimes raw feed has explicit matchup string
        const matchup = play.matchup || `${away} @ ${home}`;
        
        // Determine pick display text
        let pickText = play.pick || play.selection || play.feature_name || play.model_feature || 'N/A';
        // Cleanup pick text if it's too raw (e.g. "home_spread_-5.5" -> "Home -5.5")
        if (pickText && typeof pickText === 'string') {
            pickText = pickText.replace(/_/g, ' ');
        }

        return {
            sport: 'NBA',
            matchup: matchup,
            market: play.market || play.bet_type || 'General',
            pick: pickText,
            odds: play.odds || play.odds_available || play.price || -110,
            units: play.units || (play.kelly_fraction ? (play.kelly_fraction * 10).toFixed(2) : '1.0'),
            // Map backend 'tier' to 'confidence' or keep as is.
            // The unified table expects 'confidence' column, usually "Star" or "Normal" or numeric
            confidence: play.tier || play.confidence || 'Norm', 
            ev: play.edge || (play.ev ? `${(play.ev * 100).toFixed(1)}%` : '0%'),
            sportsbook: play.sportsbook || 'Any',
            startTime: play.time || play.game_date || play.date || new Date().toISOString(),
            raw: play // Keep raw data for details view
        };
    }

    /**
     * Checks if the API is reachable
     * @returns {Promise<boolean>}
     */
    async function checkHealth() {
        try {
             // For health check, we can use the main health endpoint
            const NBA_API_URL = getApiEndpoint();
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

    console.log('[NBA-FETCHER] v2.2 loaded - Domain Proxy Mode (Fixed Route /weekly-lineup/nba)');

})();

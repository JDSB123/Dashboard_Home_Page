/**
 * NCAAM Picks Fetcher v2.3
 * Fetches NCAAM model picks from the Azure Container App API
 * Updated to use /api/picks/{date} endpoint with trigger-on-demand support
 * 
 * Container App: ncaam-stable-prediction (NCAAM-GBSV-MODEL-RG)
 * Endpoints:
 *   - /api/picks/{date} - Get picks for date
 *   - /trigger-picks - Trigger pick generation (if picks not ready)
 *   - /picks/html - Get HTML formatted picks
 * 
 * Registry Integration:
 *   - Uses model-endpoints-bootstrap.js to get latest endpoint from Azure registry
 *   - Falls back to hardcoded URL if registry not available
 */

(function() {
    'use strict';

    // Fallback URL (used if registry endpoint not available)
    const FALLBACK_NCAAM_API_URL = 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io';
    
    /**
     * Get the current NCAAM API endpoint from registry or fallback
     * This is called dynamically to ensure we use the latest registry endpoint
     * @returns {string} The NCAAM API endpoint URL
     */
    function getNCAAMEndpoint() {
        const registryEndpoint = window.APP_CONFIG?.NCAAM_API_URL;
        if (registryEndpoint) {
            console.log('[NCAAM-PICKS] Using registry endpoint:', registryEndpoint);
            return registryEndpoint;
        }
        console.warn('[NCAAM-PICKS] Registry endpoint not available, using fallback:', FALLBACK_NCAAM_API_URL);
        return FALLBACK_NCAAM_API_URL;
    }

    // Date-aware cache: { date: { data, timestamp } }
    const picksCache = {};
    let lastSource = 'container-app';
    const CACHE_DURATION = 60000; // 1 minute
    const REQUEST_TIMEOUT = 60000; // 60 seconds (Increased for cold starts)

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

    /**
     * Trigger picks generation if not already available
     */
    async function triggerPicksIfNeeded() {
        try {
            const endpoint = getNCAAMEndpoint();
            console.log('[NCAAM-PICKS] Triggering picks generation at:', endpoint);
            const response = await fetchWithTimeout(`${endpoint}/trigger-picks`, 30000);
            if (response.ok) {
                const result = await response.json();
                console.log('[NCAAM-PICKS] Trigger response:', result);
                return true;
            }
            return false;
        } catch (error) {
            console.warn('[NCAAM-PICKS] Trigger failed:', error.message);
            return false;
        }
    }

    /**
     * Fetch NCAAM picks for a given date
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Picks data
     */
    const fetchNCAAMPicks = async function(date = 'today') {
        // Normalize date for cache key
        const cacheKey = date || 'today';

        // Use cache if fresh for this specific date
        const cached = picksCache[cacheKey];
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            console.log(`[NCAAM-PICKS] Using cached picks for ${cacheKey} (source: ${lastSource})`);
            return cached.data;
        }

        // Get endpoint dynamically from registry (ensures we use latest endpoint)
        const endpoint = getNCAAMEndpoint();
        const url = `${endpoint}/api/picks/${date}`;
        console.log(`[NCAAM-PICKS] Fetching picks from registry endpoint: ${url}`);

        try {
            let response = await fetchWithTimeout(url);
            
            // If 503, try triggering picks first then retry
            if (response.status === 503) {
                console.warn('[NCAAM-PICKS] API returned 503, attempting to trigger picks...');
                const triggered = await triggerPicksIfNeeded();
                if (triggered) {
                    // Wait a moment for picks to generate
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    response = await fetchWithTimeout(url);
                }
            }
            
            if (!response.ok) {
                throw new Error(`NCAAM API error: ${response.status}`);
            }

            let data = await response.json();
            
            // If we got 0 picks for 'today', the model might not have run yet.
            // Try triggering it actively, then wait and retry once.
            const pickCount = data.total_picks || (data.picks ? data.picks.length : 0);
            if (pickCount === 0 && (cacheKey === 'today' || cacheKey === new Date().toISOString().split('T')[0])) {
                console.warn('[NCAAM-PICKS] 0 picks found for today. Triggering generation...');
                
                // Trigger
                const triggered = await triggerPicksIfNeeded();
                
                if (triggered) {
                    console.log('[NCAAM-PICKS] Waiting 5s for generation...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Retry fetch
                    console.log('[NCAAM-PICKS] Retrying fetch...');
                    response = await fetchWithTimeout(url);
                    if (response.ok) {
                        data = await response.json();
                    }
                }
            }

            lastSource = 'container-app';

            // Cache with date key
            picksCache[cacheKey] = {
                data: data,
                timestamp: Date.now()
            };

            console.log(`[NCAAM-PICKS] ✅ Fetched ${data.total_picks || data.picks?.length || 0} picks for ${cacheKey}`);
            return data;
        } catch (error) {
            console.error('[NCAAM-PICKS] Error fetching picks:', error.message);
            throw error;
        }
    };

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    const checkHealth = async function() {
        const endpoint = getNCAAMEndpoint();
        const url = `${endpoint}/health`;
        try {
            const response = await fetchWithTimeout(url, 5000);
            if (response.ok) {
                const data = await response.json();
                return { 
                    status: 'healthy', 
                    ...data,
                    containerApp: endpoint,
                    source: window.APP_CONFIG?.NCAAM_API_URL ? 'registry' : 'fallback'
                };
            }
            return { status: 'error', code: response.status, containerApp: endpoint };
        } catch (error) {
            console.error('[NCAAM-PICKS] Health check failed:', error.message);
            return { status: 'error', message: error.message, containerApp: endpoint };
        }
    };

    /**
     * Format pick for display in the picks table
     * @param {Object} pick - Raw pick from API (v2.0 format)
     * @returns {Object} Formatted pick
     *
     * API returns:
     * {
     *   time_cst: "12/25 11:10 AM",
     *   matchup: "Away Team @ Home Team",
     *   home_team: "Home Team",
     *   away_team: "Away Team",
     *   period: "1H" or "FG",
     *   market: "SPREAD" or "TOTAL",
     *   pick: "Team Name" or "OVER"/"UNDER",
     *   pick_odds: "-110",
     *   model_line: -3.5,
     *   market_line: -2.5,
     *   edge: "+3.5",
     *   confidence: "72%",
     *   fire_rating: "GOOD"
     * }
     */
    const formatPickForTable = function(pick) {
        // Parse edge - format is "+3.5" or "-1.2"
        let edgeValue = 0;
        if (typeof pick.edge === 'string') {
            edgeValue = parseFloat(pick.edge.replace('+', '')) || 0;
        } else if (typeof pick.edge === 'number') {
            edgeValue = pick.edge;
        }

        // Convert fire_rating to number (MAX=5, STRONG=4, GOOD=3, STANDARD=2)
        let fireNum = 3;
        const fireRating = (pick.fire_rating || '').toUpperCase();
        if (fireRating === 'MAX' || fireRating === 'ELITE') fireNum = 5;
        else if (fireRating === 'STRONG') fireNum = 4;
        else if (fireRating === 'GOOD') fireNum = 3;
        else if (fireRating === 'STANDARD') fireNum = 2;

        // Map market types
        let marketType = (pick.market || 'spread').toLowerCase();

        // Parse time from "12/25 11:10 AM" format
        let timeStr = pick.time_cst || '';
        if (timeStr.includes(' ')) {
            const timeParts = timeStr.split(' ');
            timeStr = timeParts.slice(1).join(' '); // "11:10 AM"
        }

        return {
            sport: 'NCAAM',
            game: pick.matchup || `${pick.away_team} @ ${pick.home_team}`,
            pick: pick.pick || '',
            odds: pick.pick_odds || '-110',
            edge: edgeValue,
            confidence: fireNum,
            time: timeStr,
            market: marketType,
            period: pick.period || 'FG',
            line: pick.market_line || '',
            modelPrice: pick.model_line || '',
            fire_rating: pick.fire_rating || '',
            rationale: pick.rationale || pick.reason || pick.analysis || pick.notes || pick.executive_summary || '',
            modelVersion: pick.model_version || pick.modelVersion || pick.model_tag || pick.modelTag || ''
        };
    };

    // Export
    window.NCAAMPicksFetcher = {
        fetchPicks: fetchNCAAMPicks,
        checkHealth,
        formatPickForTable,
        triggerPicks: triggerPicksIfNeeded,
        getCache: (date) => picksCache[date || 'today']?.data || null,
        getLastSource: () => lastSource,
        getEndpoint: getNCAAMEndpoint,
        clearCache: (date) => {
            if (date) {
                delete picksCache[date];
            } else {
                Object.keys(picksCache).forEach(k => delete picksCache[k]);
            }
        }
    };

    // Log endpoint source on load
    const initialEndpoint = getNCAAMEndpoint();
    const endpointSource = window.APP_CONFIG?.NCAAM_API_URL ? 'registry' : 'fallback';
    console.log(`✅ NCAAMPicksFetcher v2.3 loaded - Using ${endpointSource} endpoint: ${initialEndpoint}`);

})();

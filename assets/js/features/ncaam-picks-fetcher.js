/**
 * NCAAM Picks Fetcher v2.1
 * Fetches NCAAM model picks from the Azure Container App API
 * Updated to use /api/picks/{date} endpoint (matches NBA pattern)
 * Supports date-specific caching
 */

(function() {
    'use strict';

    const NCAAM_API_URL = window.APP_CONFIG?.NCAAM_API_URL || 'https://ncaam-stable-prediction.wonderfulforest-c2d7d49a.centralus.azurecontainerapps.io';

    // Date-aware cache: { date: { data, timestamp } }
    const picksCache = {};
    const CACHE_DURATION = 60000; // 1 minute

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
            console.log(`[NCAAM-PICKS] Using cached picks for ${cacheKey}`);
            return cached.data;
        }

        const url = `${NCAAM_API_URL}/api/picks/${date}`;
        console.log(`[NCAAM-PICKS] Fetching picks from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NCAAM API error: ${response.status}`);
            }

            const data = await response.json();

            // Cache with date key
            picksCache[cacheKey] = {
                data: data,
                timestamp: Date.now()
            };

            console.log(`[NCAAM-PICKS] Fetched ${data.total_picks || 0} picks for ${cacheKey}`);
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
        const url = `${NCAAM_API_URL}/health`;
        try {
            const response = await fetch(url);
            const text = await response.text();
            return { status: text === 'ok' ? 'ok' : 'error', message: text };
        } catch (error) {
            console.error('[NCAAM-PICKS] Health check failed:', error.message);
            return { status: 'error', message: error.message };
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
        getCache: (date) => picksCache[date || 'today']?.data || null,
        clearCache: (date) => {
            if (date) {
                delete picksCache[date];
            } else {
                Object.keys(picksCache).forEach(k => delete picksCache[k]);
            }
        }
    };

    console.log('NCAAM PicksFetcher v2.1 loaded');

})();

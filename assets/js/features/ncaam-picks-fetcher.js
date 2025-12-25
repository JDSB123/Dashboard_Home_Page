/**
 * NCAAM Picks Fetcher v1.0
 * Fetches NCAAM model picks from the Azure Container App API
 */

(function() {
    'use strict';

    const NCAAM_API_URL = window.APP_CONFIG?.NCAAM_API_URL || 'https://ncaam-stable-prediction.blackglacier-5fab3573.centralus.azurecontainerapps.io';

    let picksCache = null;
    let lastFetch = null;
    const CACHE_DURATION = 60000; // 1 minute

    /**
     * Fetch NCAAM picks
     * @returns {Promise<Object>} Picks data
     */
    const fetchNCAAMPicks = async function() {
        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log('[NCAAM-PICKS] Using cached picks');
            return picksCache;
        }

        const url = `${NCAAM_API_URL}/trigger-picks-sync`;
        console.log(`[NCAAM-PICKS] Fetching picks from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NCAAM API error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();

            console.log(`[NCAAM-PICKS] Fetched picks successfully`);
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
     * @param {Object} pick - Raw pick from API
     * @returns {Object} Formatted pick
     */
    const formatPickForTable = function(pick) {
        return {
            sport: 'NCAAM',
            game: `${pick.away_team || pick.awayTeam} @ ${pick.home_team || pick.homeTeam}`,
            pick: pick.pick_display || pick.pick || pick.recommendation,
            odds: pick.odds || pick.market_odds || '',
            edge: pick.edge ? `${(pick.edge * 100).toFixed(1)}%` : '',
            confidence: pick.fire_rating || pick.confidence || '',
            time: pick.game_time || pick.time || '',
            market: pick.market_type || pick.market || '',
            period: pick.period || 'FG'
        };
    };

    // Export
    window.NCAAMPicksFetcher = {
        fetchPicks: fetchNCAAMPicks,
        checkHealth,
        formatPickForTable,
        getCache: () => picksCache,
        clearCache: () => { picksCache = null; lastFetch = null; }
    };

    console.log('NCAAM PicksFetcher v1.0 loaded');

})();

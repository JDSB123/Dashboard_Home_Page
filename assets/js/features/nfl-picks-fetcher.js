/**
 * NFL Picks Fetcher v1.0
 * Fetches NFL model picks from the Azure Container App API
 */

(function() {
    'use strict';

    const NFL_API_URL = window.APP_CONFIG?.NFL_API_URL || 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io';

    let picksCache = null;
    let lastFetch = null;
    const CACHE_DURATION = 60000; // 1 minute

    /**
     * Fetch NFL picks for a given date
     * @param {string} date - Date in YYYY-MM-DD format or 'today'
     * @returns {Promise<Object>} Picks data
     */
    const fetchNFLPicks = async function(date = 'today') {
        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log('[NFL-PICKS] Using cached picks');
            return picksCache;
        }

        // NFL API endpoint - adjust based on actual API structure
        const url = `${NFL_API_URL}/slate/${date}/executive`;
        console.log(`[NFL-PICKS] Fetching picks from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NFL API error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();

            console.log(`[NFL-PICKS] Fetched ${data.total_plays || 0} picks`);
            return data;
        } catch (error) {
            console.error('[NFL-PICKS] Error fetching picks:', error.message);
            throw error;
        }
    };

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    const checkHealth = async function() {
        const url = `${NFL_API_URL}/health`;
        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('[NFL-PICKS] Health check failed:', error.message);
            return { status: 'error', message: error.message };
        }
    };

    /**
     * Format pick for display in the picks table
     * @param {Object} pick - Raw pick from API
     * @returns {Object} Formatted pick
     */
    const formatPickForTable = function(pick) {
        const rawFire = (pick.fire_rating ?? pick.confidence ?? '').toString().trim();
        const upperFire = rawFire.toUpperCase();
        const fireMap = { MAX: 5, ELITE: 5, STRONG: 4, GOOD: 3, STANDARD: 2, LOW: 1 };
        let fireNum = 3;

        if (upperFire in fireMap) {
            fireNum = fireMap[upperFire];
        } else if (rawFire.includes('%')) {
            const pct = parseFloat(rawFire.replace('%', ''));
            if (!Number.isNaN(pct)) {
                if (pct >= 80) fireNum = 5;
                else if (pct >= 65) fireNum = 4;
                else if (pct >= 50) fireNum = 3;
                else if (pct >= 35) fireNum = 2;
                else fireNum = 1;
            }
        } else {
            const asNum = parseInt(rawFire, 10);
            if (!Number.isNaN(asNum)) fireNum = Math.max(1, Math.min(5, asNum));
        }

        return {
            sport: 'NFL',
            game: `${pick.away_team || pick.awayTeam} @ ${pick.home_team || pick.homeTeam}`,
            pick: pick.pick_display || pick.pick || pick.recommendation,
            odds: pick.odds || pick.market_odds || '',
            edge: pick.edge ? `${(pick.edge * 100).toFixed(1)}%` : '',
            confidence: fireNum,
            time: pick.game_time || pick.time || '',
            market: pick.market_type || pick.market || '',
            period: pick.period || 'FG',
            fire_rating: pick.fire_rating || '',
            fireLabel: fireNum === 5 ? 'MAX' : '',
            rationale: pick.rationale || pick.reason || pick.analysis || pick.notes || pick.executive_summary || '',
            modelVersion: pick.model_version || pick.modelVersion || pick.model_tag || pick.modelTag || ''
        };
    };

    // Export
    window.NFLPicksFetcher = {
        fetchPicks: fetchNFLPicks,
        checkHealth,
        formatPickForTable,
        getCache: () => picksCache,
        clearCache: () => { picksCache = null; lastFetch = null; }
    };

    console.log('NFL PicksFetcher v1.0 loaded');

})();

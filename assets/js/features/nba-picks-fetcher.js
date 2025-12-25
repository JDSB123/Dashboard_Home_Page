/**
 * NBA Picks Fetcher v1.0
 * Fetches NBA model picks from the Azure Container App API
 */

(function() {
    'use strict';

    const NBA_API_URL = window.APP_CONFIG?.NBA_API_URL || 'https://nba-gbsv-api.livelycoast-b48c3cb0.eastus.azurecontainerapps.io';

    let picksCache = null;
    let lastFetch = null;
    const CACHE_DURATION = 60000; // 1 minute

    /**
     * Fetch NBA picks for a given date
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Picks data
     */
    async function fetchNBAPicks(date = 'today') {
        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log('[NBA-PICKS] Using cached picks');
            return picksCache;
        }

        const url = `${NBA_API_URL}/slate/${date}/executive`;
        console.log(`[NBA-PICKS] Fetching picks from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NBA API error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();

            console.log(`[NBA-PICKS] Fetched ${data.total_plays || 0} picks`);
            return data;
        } catch (error) {
            console.error('[NBA-PICKS] Error fetching picks:', error.message);
            throw error;
        }
    }

    /**
     * Fetch full slate analysis
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Full slate data
     */
    async function fetchFullSlate(date = 'today') {
        const url = `${NBA_API_URL}/slate/${date}`;
        console.log(`[NBA-PICKS] Fetching full slate from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NBA API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[NBA-PICKS] Error fetching slate:', error.message);
            throw error;
        }
    }

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    async function checkHealth() {
        const url = `${NBA_API_URL}/health`;
        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('[NBA-PICKS] Health check failed:', error.message);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Format pick for display in the picks table
     * @param {Object} pick - Raw pick from API
     * @returns {Object} Formatted pick
     */
    function formatPickForTable(pick) {
        // Parse matchup to get teams (format: "Away Team (W-L) @ Home Team (W-L)")
        const matchupStr = pick.matchup || '';
        const matchParts = matchupStr.split(' @ ');
        const awayTeam = matchParts[0]?.replace(/\s*\([^)]*\)/, '').trim() || pick.away_team || '';
        const homeTeam = matchParts[1]?.replace(/\s*\([^)]*\)/, '').trim() || pick.home_team || '';

        // Parse edge - can be percentage string or number
        let edgeValue = pick.edge || 0;
        if (typeof edgeValue === 'string') {
            edgeValue = parseFloat(edgeValue.replace('%', '').replace('+', '')) || 0;
        }

        // Convert fire_rating to number (ELITE=5, STRONG=4, GOOD=3)
        let fireNum = 3;
        const fireRating = (pick.fire_rating || '').toUpperCase();
        if (fireRating === 'ELITE' || fireRating === 'MAX') fireNum = 5;
        else if (fireRating === 'STRONG') fireNum = 4;
        else if (fireRating === 'GOOD') fireNum = 3;

        return {
            sport: 'NBA',
            game: `${awayTeam} @ ${homeTeam}`,
            pick: pick.pick || pick.pick_display || '',
            odds: pick.pick_odds || pick.odds || pick.market_odds || '-110',
            edge: typeof edgeValue === 'number' ? `${edgeValue.toFixed(1)}%` : edgeValue,
            confidence: fireNum,
            time: pick.time_cst || pick.game_time || '',
            market: pick.market || pick.market_type || 'spread',
            period: pick.period || 'FG',
            line: pick.market_line || '',
            modelPrice: pick.model_prediction || ''
        };
    }

    // Export
    window.NBAPicksFetcher = {
        fetchPicks: fetchNBAPicks,
        fetchFullSlate,
        checkHealth,
        formatPickForTable,
        getCache: () => picksCache,
        clearCache: () => { picksCache = null; lastFetch = null; }
    };

    console.log('✅ NBAPicksFetcher v1.0 loaded');

})();

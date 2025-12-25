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
     * @param {Object} play - Raw play from API executive endpoint
     * @returns {Object} Formatted pick for table display
     *
     * API returns:
     * {
     *   time_cst: "12/25 11:10 AM",
     *   matchup: "Cleveland Cavaliers (17-14) @ New York Knicks (20-9)",
     *   period: "1H",
     *   market: "ML",
     *   pick: "New York Knicks",
     *   pick_odds: "-170",
     *   model_prediction: "79.2%",
     *   market_line: "63.0%",
     *   edge: "+16.2%",
     *   confidence: "57%",
     *   fire_rating: "GOOD"
     * }
     */
    function formatPickForTable(play) {
        // Parse matchup to get teams (format: "Away Team (W-L) @ Home Team (W-L)")
        const matchupStr = play.matchup || '';
        const matchParts = matchupStr.split(' @ ');
        const awayTeam = matchParts[0]?.replace(/\s*\([^)]*\)/, '').trim() || '';
        const homeTeam = matchParts[1]?.replace(/\s*\([^)]*\)/, '').trim() || '';

        // Parse edge - format is "+16.2%" or "-5.3%"
        let edgeValue = 0;
        if (typeof play.edge === 'string') {
            edgeValue = parseFloat(play.edge.replace('%', '').replace('+', '')) || 0;
        } else if (typeof play.edge === 'number') {
            edgeValue = play.edge;
        }

        // Convert fire_rating to number (ELITE=5, STRONG=4, GOOD=3)
        let fireNum = 3;
        const fireRating = (play.fire_rating || '').toUpperCase();
        if (fireRating === 'ELITE' || fireRating === 'MAX') fireNum = 5;
        else if (fireRating === 'STRONG') fireNum = 4;
        else if (fireRating === 'GOOD') fireNum = 3;

        // Map market types (ML, SPREAD, TOTAL) to table format
        let marketType = (play.market || 'spread').toLowerCase();
        if (marketType === 'ml') marketType = 'moneyline';

        // Parse time from "12/25 11:10 AM" format
        let timeStr = play.time_cst || '';
        if (timeStr.includes(' ')) {
            // Extract just the time part
            const timeParts = timeStr.split(' ');
            timeStr = timeParts.slice(1).join(' '); // "11:10 AM"
        }

        return {
            sport: 'NBA',
            game: `${awayTeam} @ ${homeTeam}`,
            pick: play.pick || '',
            odds: play.pick_odds || '-110',
            edge: edgeValue,
            confidence: fireNum,
            time: timeStr,
            market: marketType,
            period: play.period || 'FG',
            line: play.market_line || '',
            modelPrice: play.model_prediction || ''
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

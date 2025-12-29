/**
 * NCAAF Picks Fetcher v1.0
 * Fetches NCAAF model picks from the Azure Container App API
 */

(function() {
    'use strict';

    const NCAAF_API_URL = window.APP_CONFIG?.NCAAF_API_URL || 'https://ncaaf-v5-prod.salmonwave-314d4ffe.eastus.azurecontainerapps.io';

    let picksCache = null;
    let lastFetch = null;
    const CACHE_DURATION = 60000; // 1 minute

    /**
     * Get current NFL season and week
     * @returns {Object} { season, week }
     */
    const getCurrentSeasonWeek = function() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // NCAAF season runs Aug-Jan
        // Season year is the fall year (e.g., 2024-2025 season = 2024)
        const season = month >= 8 ? year : year - 1;

        // Approximate week calculation (season starts late August)
        const seasonStart = new Date(season, 7, 24); // Aug 24
        const weekNum = Math.max(1, Math.ceil((now - seasonStart) / (7 * 24 * 60 * 60 * 1000)));

        return { season, week: Math.min(weekNum, 15) }; // Cap at week 15 (bowl season)
    };

    /**
     * Fetch NCAAF picks for a given week
     * @param {number} season - Season year
     * @param {number} week - Week number
     * @returns {Promise<Object>} Picks data
     */
    const fetchNCAAFPicks = async function(season = null, week = null) {
        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log('[NCAAF-PICKS] Using cached picks');
            return picksCache;
        }

        // Default to current season/week
        if (!season || !week) {
            const current = getCurrentSeasonWeek();
            season = season || current.season;
            week = week || current.week;
        }

        const url = `${NCAAF_API_URL}/api/v1/predictions/week/${season}/${week}`;
        console.log(`[NCAAF-PICKS] Fetching picks from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NCAAF API error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();

            const pickCount = data.predictions?.length || data.length || 0;
            console.log(`[NCAAF-PICKS] Fetched ${pickCount} picks`);
            return data;
        } catch (error) {
            console.error('[NCAAF-PICKS] Error fetching picks:', error.message);
            throw error;
        }
    };

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    const checkHealth = async function() {
        const url = `${NCAAF_API_URL}/health`;
        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('[NCAAF-PICKS] Health check failed:', error.message);
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
            sport: 'NCAAF',
            game: `${pick.away_team || pick.awayTeam} @ ${pick.home_team || pick.homeTeam}`,
            pick: pick.pick_display || pick.pick || pick.recommendation || pick.bet_recommendation,
            odds: pick.odds || pick.market_odds || '',
            edge: pick.edge ? `${(pick.edge * 100).toFixed(1)}%` : (pick.expected_edge ? `${(pick.expected_edge * 100).toFixed(1)}%` : ''),
            confidence: fireNum,
            time: pick.game_time || pick.time || pick.kickoff || '',
            market: pick.market_type || pick.market || pick.bet_type || '',
            period: pick.period || 'FG',
            fire_rating: pick.fire_rating || '',
            fireLabel: fireNum === 5 ? 'MAX' : '',
            rationale: pick.rationale || pick.reason || pick.analysis || pick.notes || pick.executive_summary || '',
            modelVersion: pick.model_version || pick.modelVersion || pick.model_tag || pick.modelTag || ''
        };
    };

    // Export
    window.NCAAFPicksFetcher = {
        fetchPicks: fetchNCAAFPicks,
        checkHealth,
        formatPickForTable,
        getCurrentSeasonWeek,
        getCache: () => picksCache,
        clearCache: () => { picksCache = null; lastFetch = null; }
    };

    console.log('NCAAF PicksFetcher v1.0 loaded');

})();

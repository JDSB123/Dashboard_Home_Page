/**
 * NFL Picks Fetcher v1.1
 * Fetches NFL model picks from Azure Function App (primary) or Container App (fallback)
 *
 * Primary: nfl-picks-trigger Function App (/api/weekly-lineup/nfl)
 * Fallback: nfl-api Container App (/api/v1/predictions/week/{season}/{week})
 */

(function() {
    'use strict';

    // Primary: Function App for Weekly Lineup picks
    const NFL_FUNCTION_URL = window.APP_CONFIG?.NFL_FUNCTION_URL || 'https://nfl-picks-trigger.azurewebsites.net';
    // Fallback: Container App for model API
    const NFL_API_URL = window.APP_CONFIG?.NFL_API_URL || 'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io';

    let picksCache = null;
    let lastFetch = null;
    let lastSource = null; // Track which source was used
    const CACHE_DURATION = 60000; // 1 minute
    const REQUEST_TIMEOUT = 10000; // 10 seconds

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
     * Convert date to NFL season and week
     * @param {string} date - Date string ('today', 'YYYY-MM-DD', etc.)
     * @returns {Object} {season, week}
     */
    function dateToNFLSeasonWeek(date = 'today') {
        let targetDate;

        if (date === 'today') {
            targetDate = new Date();
        } else if (date === 'tomorrow') {
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 1);
        } else {
            targetDate = new Date(date);
        }

        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1; // JS months are 0-based

        // NFL season logic: Season spans calendar years, starts in September
        let season;
        if (month >= 9) {
            season = year; // Current season
        } else if (month >= 1 && month <= 8) {
            season = year - 1; // Previous season (Jan-Aug)
        } else {
            season = year - 1; // Edge case
        }

        // Calculate week of season (approximate)
        // NFL season typically starts around week 36 of the year
        const startOfYear = new Date(season, 8, 1); // September 1 of season year
        const daysSinceStart = Math.floor((targetDate - startOfYear) / (24 * 60 * 60 * 1000));
        const week = Math.max(1, Math.min(18, Math.floor(daysSinceStart / 7) + 1));

        return { season, week };
    }

    /**
     * Fetch NFL picks for a given date
     * Tries Function App first, falls back to Container App
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Picks data
     */
    async function fetchNFLPicks(date = 'today') {
        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log(`[NFL-PICKS] Using cached picks (source: ${lastSource})`);
            return picksCache;
        }

        // Try Function App first (primary source for Weekly Lineup)
        const functionUrl = `${NFL_FUNCTION_URL}/api/weekly-lineup/nfl`;
        console.log(`[NFL-PICKS] Trying Function App: ${functionUrl}`);

        try {
            const response = await fetchWithTimeout(functionUrl);
            if (response.ok) {
                const data = await response.json();
                picksCache = data;
                lastFetch = Date.now();
                lastSource = 'function-app';
                const pickCount = data.plays?.length || data.picks?.length || data.total_plays || 0;
                console.log(`[NFL-PICKS] ✅ Function App returned ${pickCount} picks`);
                return data;
            }
            console.warn(`[NFL-PICKS] Function App returned ${response.status}, trying Container App...`);
        } catch (error) {
            console.warn(`[NFL-PICKS] Function App failed: ${error.message}, trying Container App...`);
        }

        // Fallback to Container App
        const { season, week } = dateToNFLSeasonWeek(date);
        const containerUrl = `${NFL_API_URL}/api/v1/predictions/week/${season}/${week}`;
        console.log(`[NFL-PICKS] Falling back to Container App: ${containerUrl}`);

        try {
            const response = await fetchWithTimeout(containerUrl);
            if (!response.ok) {
                throw new Error(`Container App error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();
            lastSource = 'container-app';

            console.log(`[NFL-PICKS] ✅ Container App returned ${data.total_plays || 0} picks`);
            return data;
        } catch (error) {
            console.error('[NFL-PICKS] Both sources failed:', error.message);
            throw error;
        }
    }

    /**
     * Check API health for both sources
     * @returns {Promise<Object>} Health status
     */
    async function checkHealth() {
        const health = {
            functionApp: { status: 'unknown' },
            containerApp: { status: 'unknown' }
        };

        // Check Function App
        try {
            const response = await fetchWithTimeout(`${NFL_FUNCTION_URL}/api/health`, 5000);
            if (response.ok) {
                health.functionApp = await response.json();
                health.functionApp.status = 'healthy';
            } else {
                health.functionApp = { status: 'error', code: response.status };
            }
        } catch (error) {
            health.functionApp = { status: 'error', message: error.message };
        }

        // Check Container App
        try {
            const response = await fetchWithTimeout(`${NFL_API_URL}/health`, 5000);
            if (response.ok) {
                health.containerApp = await response.json();
                health.containerApp.status = 'healthy';
            } else {
                health.containerApp = { status: 'error', code: response.status };
            }
        } catch (error) {
            health.containerApp = { status: 'error', message: error.message };
        }

        return health;
    }

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
        getLastSource: () => lastSource,
        clearCache: () => { picksCache = null; lastFetch = null; lastSource = null; }
    };

    console.log('✅ NFLPicksFetcher v1.1 loaded (Function App + Container App fallback)');

})();

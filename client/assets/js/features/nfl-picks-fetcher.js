/**
 * NFL Picks Fetcher v1.2
 * Fetches NFL model picks via Azure Front Door weekly-lineup route
 *
 * Primary Route: https://www.greenbiersportventures.com/api/weekly-lineup/nfl
 * Fallback Route: Container App /api/v1/predictions/week/{season}/{week}
 */

(function() {
    'use strict';

    // Base API endpoint for weekly-lineup routes
    const getBaseApiUrl = () =>
        window.APP_CONFIG?.API_BASE_URL ||
        'https://www.greenbiersportventures.com/api';

    // Fallback: Direct Container App URL
    const getContainerEndpoint = () =>
        (window.ModelEndpointResolver?.getApiEndpoint('nfl')) ||
        window.APP_CONFIG?.NFL_API_URL ||
        'https://nfl-api.purplegrass-5889a981.eastus.azurecontainerapps.io';

    let picksCache = null;
    let lastFetch = null;
    let lastSource = null;
    const CACHE_DURATION = 60000; // 1 minute
    const REQUEST_TIMEOUT = 15000; // 15 seconds

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
     * Tries weekly-lineup route first, falls back to Container App
     * @param {string} date - Date in YYYY-MM-DD format, 'today', or 'tomorrow'
     * @returns {Promise<Object>} Picks data
     */
    async function fetchNFLPicks(date = 'today') {
        if (window.ModelEndpointResolver?.ensureRegistryHydrated) {
            window.ModelEndpointResolver.ensureRegistryHydrated();
        }
        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log(`[NFL-PICKS] Using cached picks (source: ${lastSource})`);
            return picksCache;
        }

        // Primary: Weekly-lineup route through orchestrator
        const baseUrl = getBaseApiUrl();
        const primaryUrl = `${baseUrl}/weekly-lineup/nfl`;
        console.log(`[NFL-PICKS] Fetching from weekly-lineup route: ${primaryUrl}`);

        try {
            let response = await fetchWithTimeout(primaryUrl);

            if (response.ok) {
                const data = await response.json();
                picksCache = data;
                lastFetch = Date.now();
                lastSource = 'weekly-lineup';
                const pickCount = data.plays?.length || data.picks?.length || data.total_plays || 0;
                console.log(`[NFL-PICKS] ✅ Weekly-lineup returned ${pickCount} picks`);
                return data;
            }

            console.warn(`[NFL-PICKS] Weekly-lineup route failed (${response.status}), trying Container App fallback...`);

            // Fallback to Container App
            const { season, week } = dateToNFLSeasonWeek(date);
            const containerUrl = `${getContainerEndpoint()}/api/v1/predictions/week/${season}/${week}`;
            console.log(`[NFL-PICKS] Fallback URL: ${containerUrl}`);

            response = await fetchWithTimeout(containerUrl);
            if (!response.ok) {
                throw new Error(`Both routes failed. Last error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();
            lastSource = 'container-app-fallback';

            console.log(`[NFL-PICKS] ✅ Container App returned ${data.total_plays || 0} picks`);
            return data;
        } catch (error) {
            console.error('[NFL-PICKS] All routes failed:', error.message);
            throw error;
        }
    }

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    async function checkHealth() {
        const health = {
            weeklyLineup: { status: 'unknown' },
            containerApp: { status: 'unknown' }
        };

        // Check weekly-lineup route
        try {
            const response = await fetchWithTimeout(`${getBaseApiUrl()}/health`, 5000);
            if (response.ok) {
                health.weeklyLineup = await response.json();
                health.weeklyLineup.status = 'healthy';
            } else {
                health.weeklyLineup = { status: 'error', code: response.status };
            }
        } catch (error) {
            health.weeklyLineup = { status: 'error', message: error.message };
        }

        // Check Container App
        try {
            const response = await fetchWithTimeout(`${getContainerEndpoint()}/health`, 5000);
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

    console.log('[NFL-FETCHER] v1.2 loaded - Primary: /api/weekly-lineup/nfl | Fallback: Container App');

})();

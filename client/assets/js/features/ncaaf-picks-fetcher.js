/**
 * NCAAF Picks Fetcher v1.1
 * Fetches NCAAF model picks via Azure Front Door weekly-lineup route
 *
 * Primary Route: {API_BASE_URL}/weekly-lineup/ncaaf
 * Fallback Route: Container App /api/v1/predictions/week/{season}/{week}
 */

(function() {
    'use strict';

    // Base API endpoint for weekly-lineup routes
    const getBaseApiUrl = () =>
        window.APP_CONFIG?.API_BASE_URL ||
        window.APP_CONFIG?.API_BASE_FALLBACK ||
        `${window.location.origin}/api`;

    // Fallback: Direct Container App URL
    const getContainerEndpoint = () =>
        (window.ModelEndpointResolver?.getApiEndpoint('ncaaf')) ||
        window.APP_CONFIG?.NCAAF_API_URL ||
        (window.APP_CONFIG?.API_BASE_FALLBACK ? `${window.APP_CONFIG.API_BASE_FALLBACK}/ncaaf` : '');

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
     * Get current NCAAF season and week
     * @returns {Object} { season, week }
     */
    const getCurrentSeasonWeek = function() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // NCAAF season runs Aug-Jan
        const season = month >= 8 ? year : year - 1;

        // Approximate week calculation (season starts late August)
        const seasonStart = new Date(season, 7, 24); // Aug 24
        const weekNum = Math.max(1, Math.ceil((now - seasonStart) / (7 * 24 * 60 * 60 * 1000)));

        return { season, week: Math.min(weekNum, 15) }; // Cap at week 15 (bowl season)
    };

    /**
     * Fetch NCAAF picks for a given week
     * Tries weekly-lineup route first, falls back to Container App
     * @param {number} season - Season year (optional)
     * @param {number} week - Week number (optional)
     * @returns {Promise<Object>} Picks data
     */
    const fetchNCAAFPicks = async function(season = null, week = null) {
        if (window.ModelEndpointResolver?.ensureRegistryHydrated) {
            window.ModelEndpointResolver.ensureRegistryHydrated();
        }

        // Use cache if fresh
        if (picksCache && lastFetch && (Date.now() - lastFetch < CACHE_DURATION)) {
            console.log(`[NCAAF-PICKS] Using cached picks (source: ${lastSource})`);
            return picksCache;
        }

        // Primary: Weekly-lineup route through orchestrator
        const baseUrl = getBaseApiUrl();
        const primaryUrl = `${baseUrl}/weekly-lineup/ncaaf`;
        console.log(`[NCAAF-PICKS] Fetching from weekly-lineup route: ${primaryUrl}`);

        try {
            let response = await fetchWithTimeout(primaryUrl);

            if (response.ok) {
                const data = await response.json();
                picksCache = data;
                lastFetch = Date.now();
                lastSource = 'weekly-lineup';
                const pickCount = data.predictions?.length || data.picks?.length || 0;
                console.log(`[NCAAF-PICKS] ✅ Weekly-lineup returned ${pickCount} picks`);
                return data;
            }

            console.warn(`[NCAAF-PICKS] Weekly-lineup route failed (${response.status}), trying Container App fallback...`);

            // Default to current season/week for fallback
            if (!season || !week) {
                const current = getCurrentSeasonWeek();
                season = season || current.season;
                week = week || current.week;
            }

            // Fallback to Container App
            const containerUrl = `${getContainerEndpoint()}/api/v1/predictions/week/${season}/${week}`;
            console.log(`[NCAAF-PICKS] Fallback URL: ${containerUrl}`);

            response = await fetchWithTimeout(containerUrl);
            if (!response.ok) {
                throw new Error(`Both routes failed. Last error: ${response.status}`);
            }

            const data = await response.json();
            picksCache = data;
            lastFetch = Date.now();
            lastSource = 'container-app-fallback';

            const pickCount = data.predictions?.length || data.length || 0;
            console.log(`[NCAAF-PICKS] ✅ Container App returned ${pickCount} picks`);
            return data;
        } catch (error) {
            console.error('[NCAAF-PICKS] All routes failed:', error.message);
            throw error;
        }
    };

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    const checkHealth = async function() {
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
        getLastSource: () => lastSource,
        clearCache: () => { picksCache = null; lastFetch = null; lastSource = null; }
    };

    console.log('[NCAAF-FETCHER] v1.1 loaded - Primary: /api/weekly-lineup/ncaaf | Fallback: Container App');

})();

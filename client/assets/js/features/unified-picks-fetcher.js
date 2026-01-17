/**
 * Unified Picks Fetcher v1.3
 * Orchestrates fetching picks from all model APIs in PARALLEL
 * Supports date-specific fetching with cache-first strategy
 *
 * v1.3 Performance improvements:
 * - Parallel fetching of all leagues (was sequential)
 * - Reduced timeout from 60s to 15s
 * - Cache-first strategy
 * - Progressive rendering support
 */

(function() {
    'use strict';

    // Helper to check if debug mode is enabled
    const isDebugMode = () => window.APP_CONFIG?.DEBUG_MODE === true;

    // Debug-gated logging
    const debugLog = (...args) => {
        if (isDebugMode()) console.log(...args);
    };
    const debugWarn = (...args) => {
        if (isDebugMode()) console.warn(...args);
    };
    const debugError = (...args) => {
        // Always log errors, but with less verbosity in production
        if (isDebugMode()) {
            console.error(...args);
        } else {
            console.error(args[0]); // Only first arg in production
        }
    };

    // Request timeout in milliseconds (reduced from 60s for better UX)
    const REQUEST_TIMEOUT_MS = 15000;

    // Cache for picks results
    const picksCache = {
        data: null,
        timestamp: 0,
        date: null,
        league: null
    };
    const CACHE_DURATION_MS = 60000; // 1 minute cache

    const extractModelStampFromResponse = (data) => {
        if (!data || typeof data !== 'object') return '';

        const read = (obj, path) => path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
        const pickFirstString = (...paths) => {
            for (const path of paths) {
                const value = read(data, path);
                if (typeof value === 'string' && value.trim()) return value.trim();
            }
            return '';
        };

        const tag = pickFirstString(
            'model_tag', 'modelTag',
            'model_version', 'modelVersion',
            'version', 'build', 'build_version',
            'meta.model_tag', 'meta.modelTag',
            'meta.model_version', 'meta.modelVersion',
            'meta.version', 'meta.build',
            'metadata.model_tag', 'metadata.modelTag',
            'metadata.model_version', 'metadata.modelVersion',
            'metadata.version', 'metadata.build'
        );

        const sha = pickFirstString(
            'git_sha', 'gitSha', 'commit', 'commit_sha', 'commitSha',
            'meta.git_sha', 'meta.gitSha', 'meta.commit', 'meta.commit_sha', 'meta.commitSha',
            'metadata.git_sha', 'metadata.gitSha', 'metadata.commit', 'metadata.commit_sha', 'metadata.commitSha'
        );

        if (tag && sha) return `${tag} (${sha.slice(0, 8)})`;
        return tag || (sha ? sha.slice(0, 12) : '');
    };

    const normalizeFireRating = (rawFire, edgeValue = 0) => {
        const clamp = (n) => Math.max(0, Math.min(5, n));

        if (typeof rawFire === 'number' && Number.isFinite(rawFire)) {
            const fire = clamp(Math.round(rawFire));
            return { fire, fireLabel: fire === 5 ? 'MAX' : '' };
        }

        const str = (rawFire ?? '').toString().trim();
        if (str) {
            const asNum = parseInt(str, 10);
            if (!Number.isNaN(asNum)) {
                const fire = clamp(asNum);
                return { fire, fireLabel: fire === 5 ? 'MAX' : '' };
            }

            const upper = str.toUpperCase();
            const map = { MAX: 5, ELITE: 5, STRONG: 4, GOOD: 3, STANDARD: 2, LOW: 1 };
            if (upper in map) {
                const fire = map[upper];
                return { fire, fireLabel: fire === 5 ? 'MAX' : '' };
            }

            if (str.includes('%')) {
                const pct = parseFloat(str.replace('%', ''));
                if (!Number.isNaN(pct)) {
                    if (pct >= 80) return { fire: 5, fireLabel: 'MAX' };
                    if (pct >= 65) return { fire: 4, fireLabel: '' };
                    if (pct >= 50) return { fire: 3, fireLabel: '' };
                    if (pct >= 35) return { fire: 2, fireLabel: '' };
                    return { fire: 1, fireLabel: '' };
                }
            }
        }

        const computed = clamp(Math.ceil((parseFloat(edgeValue) || 0) / 1.5));
        return { fire: computed, fireLabel: computed === 5 ? 'MAX' : '' };
    };

    /**
     * Fetch with timeout using AbortController
     * @param {string} url - URL to fetch
     * @param {object} options - Fetch options
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Response>}
     */
    const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeoutMs}ms`);
            }
            throw error;
        }
    };

    /**
     * Check if cache is valid for the given parameters
     */
    const isCacheValid = (league, date) => {
        // First check localStorage via DataCacheManager if available
        if (window.DataCacheManager) {
            const cacheKey = `picks_${league}_${date}`;
            const cached = window.DataCacheManager.get(cacheKey);
            if (cached) {
                debugLog('[UNIFIED-FETCHER] Found valid cache in localStorage');
                picksCache.data = cached;
                picksCache.timestamp = Date.now();
                picksCache.date = date;
                picksCache.league = league;
                return true;
            }
        }

        // Fallback to in-memory cache
        return picksCache.data &&
               picksCache.league === league &&
               picksCache.date === date &&
               (Date.now() - picksCache.timestamp) < CACHE_DURATION_MS;
    };

    /**
     * Fetch picks for a single league (helper for parallel fetching)
     */
    const fetchLeaguePicks = async (leagueName, date, fetcher) => {
        try {
            const result = await fetcher.fetchPicks(date);
            const apiData = result.success ? result.data : result;
            const modelStamp = extractModelStampFromResponse(apiData);
            const picks = apiData?.picks || apiData?.plays || apiData?.predictions || apiData?.recommendations || [];

            return {
                league: leagueName,
                picks: picks.map(pick => {
                    const formatted = fetcher.formatPickForTable(pick);
                    if (modelStamp && !formatted.modelStamp) formatted.modelStamp = modelStamp;
                    return formatted;
                }),
                error: null
            };
        } catch (e) {
            debugError(`[UNIFIED-FETCHER] ${leagueName} fetch error:`, e.message);
            return {
                league: leagueName,
                picks: [],
                error: e.message
            };
        }
    };

    /**
     * Fetch picks from all or specific league APIs IN PARALLEL
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf', 'nhl', 'mlb'
     * @param {string} date - 'today', 'tomorrow', or 'YYYY-MM-DD' (default: 'today')
     * @param {Object} options - { skipCache: false, onLeagueComplete: null }
     * @returns {Promise<Object>} Object with picks array, errors, and metadata
     */
    const fetchPicks = async function(league = 'all', date = 'today', options = {}) {
        const { skipCache = false, onLeagueComplete = null } = options;

        // Cache-first strategy: return cached data if valid
        if (!skipCache && isCacheValid(league, date)) {
            debugLog('[UNIFIED-FETCHER] Returning cached picks');
            return picksCache.data;
        }

        if (window.ModelEndpointResolver?.ensureRegistryHydrated) {
            window.ModelEndpointResolver.ensureRegistryHydrated();
        }

        const leagueUpper = league.toUpperCase();
        const startTime = Date.now();
        debugLog(`[UNIFIED-FETCHER] Fetching picks for: ${league}, date: ${date} (PARALLEL mode)`);

        // Build list of fetchers to run in parallel
        const fetchPromises = [];
        const DISABLED_LEAGUES = new Set(window.WEEKLY_LINEUP_DISABLED_LEAGUES || ['NFL', 'NCAAF']);
        const leagueFetchers = [
            { name: 'NBA', fetcher: window.NBAPicksFetcher, match: leagueUpper === 'NBA' || league === 'all' },
            { name: 'NCAAM', fetcher: window.NCAAMPicksFetcher, match: leagueUpper === 'NCAAM' || leagueUpper === 'NCAAB' || league === 'all' },
            { name: 'NFL', fetcher: window.NFLPicksFetcher, match: !(DISABLED_LEAGUES.has('NFL')) && (leagueUpper === 'NFL' || league === 'all') },
            { name: 'NCAAF', fetcher: window.NCAAFPicksFetcher, match: !(DISABLED_LEAGUES.has('NCAAF')) && (leagueUpper === 'NCAAF' || league === 'all') },
            { name: 'NHL', fetcher: window.NHLPicksFetcher, match: leagueUpper === 'NHL' || league === 'all' },
            { name: 'MLB', fetcher: window.MLBPicksFetcher, match: leagueUpper === 'MLB' || league === 'all' }
        ];

        for (const { name, fetcher, match } of leagueFetchers) {
            if (match && fetcher) {
                const promise = fetchLeaguePicks(name, date, fetcher).then(result => {
                    // Progressive callback: notify when each league completes
                    if (onLeagueComplete && result.picks.length > 0) {
                        onLeagueComplete(result.league, result.picks);
                    }
                    return result;
                });
                fetchPromises.push(promise);
            }
        }

        // Wait for all fetches to complete in parallel
        const results = await Promise.allSettled(fetchPromises);

        // Aggregate results
        let allPicks = [];
        const errors = [];

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { league: leagueName, picks, error } = result.value;
                if (picks.length > 0) {
                    allPicks.push(...picks);
                    debugLog(`[UNIFIED-FETCHER] ${leagueName}: ${picks.length} picks`);
                }
                if (error) {
                    errors.push({ league: leagueName, error });
                }
            } else {
                debugError('[UNIFIED-FETCHER] Fetch rejected:', result.reason);
            }
        }

        const elapsed = Date.now() - startTime;
        debugLog(`[UNIFIED-FETCHER] Completed in ${elapsed}ms - ${allPicks.length} total picks from ${fetchPromises.length} leagues`);

        // Cache the results
        const response = {
            picks: allPicks,
            errors,
            meta: {
                fetchedAt: new Date().toISOString(),
                elapsedMs: elapsed,
                leaguesQueried: fetchPromises.length
            }
        };

        // Store in localStorage via DataCacheManager (5 min TTL)
        if (window.DataCacheManager) {
            const cacheKey = `picks_${league}_${date}`;
            window.DataCacheManager.set(cacheKey, response, 5 * 60 * 1000);
        }

        // Also store in memory cache
        picksCache.data = response;
        picksCache.timestamp = Date.now();
        picksCache.date = date;
        picksCache.league = league;

        return response;
    };


    /**
     * Fetch picks and add them to the weekly lineup table
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf'
     * @param {string} date - 'today', 'tomorrow', or 'YYYY-MM-DD' (default: 'today')
     * @param {Object} options - { skipCache: false }
     */
    const fetchAndDisplayPicks = async function(league = 'all', date = 'today', options = {}) {
        const result = await fetchPicks(league, date, options);

        // Handle API failures - notify user
        const allApisFailed = result.picks.length === 0 && result.errors.length > 0;
        if (allApisFailed) {
            const failedLeagues = result.errors.map(e => e.league).join(', ');
            if (window.WeeklyLineup?.showNotification) {
                window.WeeklyLineup.showNotification(
                    `Unable to load picks. API unavailable for: ${failedLeagues}`,
                    'error'
                );
            }
            // Show empty state in table
            if (window.WeeklyLineup?.showEmptyState) {
                window.WeeklyLineup.showEmptyState('No picks available. Please try again later.');
            }
            return result;
        }

        // Handle partial failures - warn user but continue
        if (result.errors.length > 0 && result.picks.length > 0) {
            const failedLeagues = result.errors.map(e => e.league).join(', ');
            if (window.WeeklyLineup?.showNotification) {
                window.WeeklyLineup.showNotification(
                    `Some leagues unavailable: ${failedLeagues}`,
                    'warning'
                );
            }
        }

        // Use WeeklyLineup.populateTable if available (weekly lineup page)
        if (window.WeeklyLineup?.populateTable && result.picks.length > 0) {
            // Transform picks to the format expected by populateWeeklyLineupTable
            const formattedPicks = result.picks.map(pick => {
                // Parse game string "Away @ Home" to get teams
                const gameParts = (pick.game || '').split(' @ ');
                const awayTeam = gameParts[0] || '';
                const homeTeam = gameParts[1] || '';

                // Parse edge percentage string to number
                let edgeNum = 0;
                if (typeof pick.edge === 'string') {
                    edgeNum = parseFloat(pick.edge.replace('%', '')) || 0;
                } else if (typeof pick.edge === 'number') {
                    edgeNum = pick.edge;
                }

                const fireMeta = normalizeFireRating(
                    pick.fire ?? pick.confidence ?? pick.fire_rating ?? pick.fireRating,
                    edgeNum
                );

                return {
                    date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    time: pick.time || '',
                    sport: pick.sport || 'NBA',
                    awayTeam: awayTeam,
                    homeTeam: homeTeam,
                    segment: pick.period || 'FG',
                    pickTeam: pick.pick || '',
                    pickType: (pick.market || 'spread').toLowerCase(),
                    line: pick.line || '',
                    odds: pick.odds || '-110',
                    modelPrice: pick.modelPrice || '',
                    edge: edgeNum,
                    fire: fireMeta.fire,
                    fireLabel: pick.fireLabel || fireMeta.fireLabel,
                    rationale: pick.rationale || pick.reason || pick.notes || pick.explanation || '',
                    modelStamp: pick.modelStamp || pick.model_version || pick.modelVersion || pick.modelTag || '',
                    status: 'pending'
                };
            });

            // Sort by edge (highest first)
            formattedPicks.sort((a, b) => b.edge - a.edge);

            window.WeeklyLineup.populateTable(formattedPicks);
            debugLog(`[UNIFIED-FETCHER] Populated table with ${formattedPicks.length} picks`);

            // Show success notification
            if (window.WeeklyLineup.showNotification) {
                window.WeeklyLineup.showNotification(`Loaded ${formattedPicks.length} picks`, 'success');
            }
        } else if (result.picks.length === 0) {
            // No picks available (but no errors either - just no games today)
            if (window.WeeklyLineup?.showEmptyState) {
                window.WeeklyLineup.showEmptyState('No picks available for the selected date.');
            }
        }

        return result;
    };

    /**
     * Check health of all APIs
     * @returns {Promise<Object>} Health status for each API
     */
    const checkAllHealth = async function() {
        const health = {};

        if (window.NBAPicksFetcher) {
            health.nba = await window.NBAPicksFetcher.checkHealth();
        }
        if (window.NCAAMPicksFetcher) {
            health.ncaam = await window.NCAAMPicksFetcher.checkHealth();
        }
        if (window.NFLPicksFetcher) {
            health.nfl = await window.NFLPicksFetcher.checkHealth();
        }
        if (window.NCAAFPicksFetcher) {
            health.ncaaf = await window.NCAAFPicksFetcher.checkHealth();
        }
        if (window.NHLPicksFetcher) {
            health.nhl = await window.NHLPicksFetcher.checkHealth();
        }
        if (window.MLBPicksFetcher) {
            health.mlb = await window.MLBPicksFetcher.checkHealth();
        }

        return health;
    };

    /**
     * Clear the picks cache (useful when forcing refresh)
     */
    const clearCache = () => {
        picksCache.data = null;
        picksCache.timestamp = 0;
        picksCache.date = null;
        picksCache.league = null;
    };

    // Export
    window.UnifiedPicksFetcher = {
        fetchPicks,
        fetchAndDisplayPicks,
        checkAllHealth,
        clearCache,
        isCacheValid: (league, date) => isCacheValid(league, date)
    };

    console.log('[UNIFIED-FETCHER] v1.3 loaded - PARALLEL mode | Cache-first | 15s timeout');

})();

/**
 * Unified Picks Fetcher v1.2
 * Orchestrates fetching picks from all model APIs and adds them to the weekly lineup
 * Supports date-specific fetching
 *
 * Production-ready: No demo/placeholder data fallback
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

    // Request timeout in milliseconds (60 seconds for cold starts)
    const REQUEST_TIMEOUT_MS = 60000;

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
     * Fetch picks from all or specific league APIs
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf', 'nhl', 'mlb'
     * @param {string} date - 'today', 'tomorrow', or 'YYYY-MM-DD' (default: 'today')
     * @returns {Promise<Object>} Object with picks array, errors, and metadata
     */
    const fetchPicks = async function(league = 'all', date = 'today') {
        let allPicks = [];
        const errors = [];
        const leagueUpper = league.toUpperCase();

        debugLog(`[UNIFIED-FETCHER] Fetching picks for: ${league}, date: ${date}`);

        // NBA
        if (league === 'all' || leagueUpper === 'NBA') {
            try {
                if (window.NBAPicksFetcher) {
                    const data = await window.NBAPicksFetcher.fetchPicks(date);
                    const modelStamp = extractModelStampFromResponse(data);
                    // API returns { plays: [...] } not { picks: [...] }
                    const plays = data.plays || data.picks || data.recommendations || [];
                    plays.forEach(play => {
                        const formatted = window.NBAPicksFetcher.formatPickForTable(play);
                        if (modelStamp && !formatted.modelStamp) formatted.modelStamp = modelStamp;
                        allPicks.push(formatted);
                    });
                    debugLog(`[UNIFIED-FETCHER] NBA: ${plays.length} picks`);
                }
            } catch (e) {
                debugError('[UNIFIED-FETCHER] NBA fetch error:', e.message);
                errors.push({ league: 'NBA', error: e.message });
            }
        }

        // NCAAM - Try container app first, fallback to main API
        if (league === 'all' || leagueUpper === 'NCAAM' || leagueUpper === 'NCAAB') {
            try {
                if (window.NCAAMPicksFetcher) {
                    let data;
                    try {
                        data = await window.NCAAMPicksFetcher.fetchPicks(date);
                    } catch (containerError) {
                debugWarn('[UNIFIED-FETCHER] NCAAM container app failed:', containerError.message);
                
                // Fallback to main API is NOT supported for NCAAM yet (Orchestrator has no picks endpoint)
                // We re-throw or handle gracefully to avoid 404 spam
                throw new Error(`NCAAM fetch failed: ${containerError.message}`);

                /* 
                // DISABLED: Main API does not support /picks route currently
                const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=ncaam`;
                const response = await fetchWithTimeout(mainApiUrl);
                if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                data = await response.json();
                */

                    const modelStamp = extractModelStampFromResponse(data);
                    const picks = data.picks || data.plays || data.recommendations || [];
                    picks.forEach(pick => {
                        const formatted = window.NCAAMPicksFetcher.formatPickForTable(pick);
                        if (modelStamp && !formatted.modelStamp) formatted.modelStamp = modelStamp;
                        allPicks.push(formatted);
                    });
                    debugLog(`[UNIFIED-FETCHER] NCAAM: ${picks.length} picks`);
                }
            } catch (e) {
                debugError('[UNIFIED-FETCHER] NCAAM fetch error:', e.message);
                errors.push({ league: 'NCAAM', error: e.message });
            }
        }

        // NFL - Try container app first, fallback to main API
        if (league === 'all' || leagueUpper === 'NFL') {
            try {
                if (window.NFLPicksFetcher) {
                    let data;
                    try {
                        data = await window.NFLPicksFetcher.fetchPicks(date);
                    } catch (containerError) {
                        debugWarn('[UNIFIED-FETCHER] NFL container app failed, trying main API:', containerError.message);
                        // Fallback to main API with timeout
                        const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=nfl`;
                        const response = await fetchWithTimeout(mainApiUrl);
                        if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                        data = await response.json();
                    }

                    const modelStamp = extractModelStampFromResponse(data);
                    const picks = data.picks || data.plays || data.recommendations || [];
                    picks.forEach(pick => {
                        const formatted = window.NFLPicksFetcher.formatPickForTable(pick);
                        if (modelStamp && !formatted.modelStamp) formatted.modelStamp = modelStamp;
                        allPicks.push(formatted);
                    });
                    debugLog(`[UNIFIED-FETCHER] NFL: ${picks.length} picks`);
                }
            } catch (e) {
                debugError('[UNIFIED-FETCHER] NFL fetch error:', e.message);
                errors.push({ league: 'NFL', error: e.message });
            }
        }

        // NCAAF - Try container app first, fallback to main API
        if (league === 'all' || leagueUpper === 'NCAAF') {
            try {
                if (window.NCAAFPicksFetcher) {
                    let data;
                    try {
                        data = await window.NCAAFPicksFetcher.fetchPicks(date);
                    } catch (containerError) {
                        debugWarn('[UNIFIED-FETCHER] NCAAF container app failed, trying main API:', containerError.message);
                        // Fallback to main API with timeout
                        const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=ncaaf`;
                        const response = await fetchWithTimeout(mainApiUrl);
                        if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                        data = await response.json();
                    }

                    const modelStamp = extractModelStampFromResponse(data);
                    const predictions = data.predictions || data.picks || data.plays || [];
                    predictions.forEach(pick => {
                        const formatted = window.NCAAFPicksFetcher.formatPickForTable(pick);
                        if (modelStamp && !formatted.modelStamp) formatted.modelStamp = modelStamp;
                        allPicks.push(formatted);
                    });
                    debugLog(`[UNIFIED-FETCHER] NCAAF: ${predictions.length} picks`);
                }
            } catch (e) {
                debugError('[UNIFIED-FETCHER] NCAAF fetch error:', e.message);
                errors.push({ league: 'NCAAF', error: e.message });
            }
        }

        // NHL - Will activate when NHLPicksFetcher is created and loaded
        if (league === 'all' || leagueUpper === 'NHL') {
            try {
                if (window.NHLPicksFetcher) {
                    let data;
                    try {
                        data = await window.NHLPicksFetcher.fetchPicks(date);
                    } catch (containerError) {
                        debugWarn('[UNIFIED-FETCHER] NHL container app failed, trying main API:', containerError.message);
                        const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=nhl`;
                        const response = await fetchWithTimeout(mainApiUrl);
                        if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                        data = await response.json();
                    }

                    const modelStamp = extractModelStampFromResponse(data);
                    const picks = data.picks || data.plays || data.predictions || [];
                    picks.forEach(pick => {
                        const formatted = window.NHLPicksFetcher.formatPickForTable(pick);
                        if (modelStamp && !formatted.modelStamp) formatted.modelStamp = modelStamp;
                        allPicks.push(formatted);
                    });
                    debugLog(`[UNIFIED-FETCHER] NHL: ${picks.length} picks`);
                }
            } catch (e) {
                debugError('[UNIFIED-FETCHER] NHL fetch error:', e.message);
                errors.push({ league: 'NHL', error: e.message });
            }
        }

        // MLB - Will activate when MLBPicksFetcher is created and loaded
        if (league === 'all' || leagueUpper === 'MLB') {
            try {
                if (window.MLBPicksFetcher) {
                    let data;
                    try {
                        data = await window.MLBPicksFetcher.fetchPicks(date);
                    } catch (containerError) {
                        debugWarn('[UNIFIED-FETCHER] MLB container app failed, trying main API:', containerError.message);
                        const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=mlb`;
                        const response = await fetchWithTimeout(mainApiUrl);
                        if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                        data = await response.json();
                    }

                    const modelStamp = extractModelStampFromResponse(data);
                    const picks = data.picks || data.plays || data.predictions || [];
                    picks.forEach(pick => {
                        const formatted = window.MLBPicksFetcher.formatPickForTable(pick);
                        if (modelStamp && !formatted.modelStamp) formatted.modelStamp = modelStamp;
                        allPicks.push(formatted);
                    });
                    debugLog(`[UNIFIED-FETCHER] MLB: ${picks.length} picks`);
                }
            } catch (e) {
                debugError('[UNIFIED-FETCHER] MLB fetch error:', e.message);
                errors.push({ league: 'MLB', error: e.message });
            }
        }

        // Production mode: No demo data fallback - show actual API status to users
        // If all APIs failed, the errors array will contain details for user notification
        const allApisFailed = allPicks.length === 0 && errors.length > 0;

        debugLog(`[UNIFIED-FETCHER] Total picks fetched: ${allPicks.length}`);

        return {
            picks: allPicks,
            errors: errors,
            date: date,
            timestamp: new Date().toISOString(),
            allApisFailed: allApisFailed
        };
    };

    /**
     * Fetch picks and add them to the weekly lineup table
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf'
     * @param {string} date - 'today', 'tomorrow', or 'YYYY-MM-DD' (default: 'today')
     */
    const fetchAndDisplayPicks = async function(league = 'all', date = 'today') {
        const result = await fetchPicks(league, date);

        // Handle API failures - notify user
        if (result.allApisFailed) {
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

    // Export
    window.UnifiedPicksFetcher = {
        fetchPicks,
        fetchAndDisplayPicks,
        checkAllHealth
    };

    debugLog('UnifiedPicksFetcher v1.2 loaded');

})();

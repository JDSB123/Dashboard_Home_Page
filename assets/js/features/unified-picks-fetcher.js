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

    /**
     * Fetch picks from all or specific league APIs
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf'
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
                    // API returns { plays: [...] } not { picks: [...] }
                    const plays = data.plays || data.picks || data.recommendations || [];
                    plays.forEach(play => {
                        allPicks.push(window.NBAPicksFetcher.formatPickForTable(play));
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
                        debugWarn('[UNIFIED-FETCHER] NCAAM container app failed, trying main API:', containerError.message);
                        // Fallback to main API
                        const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=ncaam`;
                        const response = await fetch(mainApiUrl);
                        if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                        data = await response.json();
                    }

                    const picks = data.picks || data.plays || data.recommendations || [];
                    picks.forEach(pick => {
                        allPicks.push(window.NCAAMPicksFetcher.formatPickForTable(pick));
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
                        // Fallback to main API
                        const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=nfl`;
                        const response = await fetch(mainApiUrl);
                        if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                        data = await response.json();
                    }

                    const picks = data.picks || data.plays || data.recommendations || [];
                    picks.forEach(pick => {
                        allPicks.push(window.NFLPicksFetcher.formatPickForTable(pick));
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
                        // Fallback to main API
                        const mainApiUrl = `${window.APP_CONFIG?.API_BASE_URL || 'https://green-bier-picks-api.azurewebsites.net/api'}/picks?league=ncaaf`;
                        const response = await fetch(mainApiUrl);
                        if (!response.ok) throw new Error(`Main API error: ${response.status}`);
                        data = await response.json();
                    }

                    const predictions = data.predictions || data.picks || data.plays || [];
                    predictions.forEach(pick => {
                        allPicks.push(window.NCAAFPicksFetcher.formatPickForTable(pick));
                    });
                    debugLog(`[UNIFIED-FETCHER] NCAAF: ${predictions.length} picks`);
                }
            } catch (e) {
                debugError('[UNIFIED-FETCHER] NCAAF fetch error:', e.message);
                errors.push({ league: 'NCAAF', error: e.message });
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
                    fire: parseInt(pick.confidence) || 3,
                    fireLabel: edgeNum >= 6 ? 'MAX' : '',
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

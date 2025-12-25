/**
 * Unified Picks Fetcher v1.0
 * Orchestrates fetching picks from all model APIs and adds them to the weekly lineup
 */

(function() {
    'use strict';

    /**
     * Fetch picks from all or specific league APIs
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf'
     * @returns {Promise<Array>} Array of formatted picks
     */
    const fetchPicks = async function(league = 'all') {
        const allPicks = [];
        const errors = [];
        const leagueUpper = league.toUpperCase();

        console.log(`[UNIFIED-FETCHER] Fetching picks for: ${league}`);

        // NBA
        if (league === 'all' || leagueUpper === 'NBA') {
            try {
                if (window.NBAPicksFetcher) {
                    const data = await window.NBAPicksFetcher.fetchPicks('today');
                    const picks = data.picks || data.plays || data.recommendations || [];
                    picks.forEach(pick => {
                        allPicks.push(window.NBAPicksFetcher.formatPickForTable(pick));
                    });
                    console.log(`[UNIFIED-FETCHER] NBA: ${picks.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NBA fetch error:', e.message);
                errors.push({ league: 'NBA', error: e.message });
            }
        }

        // NCAAM
        if (league === 'all' || leagueUpper === 'NCAAM') {
            try {
                if (window.NCAAMPicksFetcher) {
                    const data = await window.NCAAMPicksFetcher.fetchPicks();
                    const picks = data.picks || data.plays || data.recommendations || [];
                    picks.forEach(pick => {
                        allPicks.push(window.NCAAMPicksFetcher.formatPickForTable(pick));
                    });
                    console.log(`[UNIFIED-FETCHER] NCAAM: ${picks.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NCAAM fetch error:', e.message);
                errors.push({ league: 'NCAAM', error: e.message });
            }
        }

        // NFL
        if (league === 'all' || leagueUpper === 'NFL') {
            try {
                if (window.NFLPicksFetcher) {
                    const data = await window.NFLPicksFetcher.fetchPicks('today');
                    const picks = data.picks || data.plays || data.recommendations || [];
                    picks.forEach(pick => {
                        allPicks.push(window.NFLPicksFetcher.formatPickForTable(pick));
                    });
                    console.log(`[UNIFIED-FETCHER] NFL: ${picks.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NFL fetch error:', e.message);
                errors.push({ league: 'NFL', error: e.message });
            }
        }

        // NCAAF
        if (league === 'all' || leagueUpper === 'NCAAF') {
            try {
                if (window.NCAAFPicksFetcher) {
                    const data = await window.NCAAFPicksFetcher.fetchPicks();
                    const predictions = data.predictions || data.picks || data.plays || [];
                    predictions.forEach(pick => {
                        allPicks.push(window.NCAAFPicksFetcher.formatPickForTable(pick));
                    });
                    console.log(`[UNIFIED-FETCHER] NCAAF: ${predictions.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NCAAF fetch error:', e.message);
                errors.push({ league: 'NCAAF', error: e.message });
            }
        }

        console.log(`[UNIFIED-FETCHER] Total picks fetched: ${allPicks.length}`);

        return {
            picks: allPicks,
            errors: errors,
            timestamp: new Date().toISOString()
        };
    };

    /**
     * Fetch picks and add them to the weekly lineup table
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf'
     */
    const fetchAndDisplayPicks = async function(league = 'all') {
        const result = await fetchPicks(league);

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
            console.log(`[UNIFIED-FETCHER] Populated table with ${formattedPicks.length} picks`);

            // Show notification
            if (window.WeeklyLineup.showNotification) {
                window.WeeklyLineup.showNotification(`Loaded ${formattedPicks.length} picks from API`, 'success');
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

    console.log('UnifiedPicksFetcher v1.0 loaded');

})();

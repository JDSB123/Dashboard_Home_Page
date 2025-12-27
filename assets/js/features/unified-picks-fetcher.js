/**
 * Unified Picks Fetcher v1.1
 * Orchestrates fetching picks from all model APIs and adds them to the weekly lineup
 * Supports date-specific fetching
 */

(function() {
    'use strict';

    /**
     * Fetch picks from all or specific league APIs
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf'
     * @param {string} date - 'today', 'tomorrow', or 'YYYY-MM-DD' (default: 'today')
     * @returns {Promise<Array>} Array of formatted picks
     */
    const fetchPicks = async function(league = 'all', date = 'today') {
        const allPicks = [];
        const errors = [];
        const leagueUpper = league.toUpperCase();

        console.log(`[UNIFIED-FETCHER] Fetching picks for: ${league}, date: ${date}`);

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
                    console.log(`[UNIFIED-FETCHER] NBA: ${plays.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NBA fetch error:', e.message);
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
                        console.warn('[UNIFIED-FETCHER] NCAAM container app failed, trying main API:', containerError.message);
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
                    console.log(`[UNIFIED-FETCHER] NCAAM: ${picks.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NCAAM fetch error:', e.message);
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
                        console.warn('[UNIFIED-FETCHER] NFL container app failed, trying main API:', containerError.message);
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
                    console.log(`[UNIFIED-FETCHER] NFL: ${picks.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NFL fetch error:', e.message);
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
                        console.warn('[UNIFIED-FETCHER] NCAAF container app failed, trying main API:', containerError.message);
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
                    console.log(`[UNIFIED-FETCHER] NCAAF: ${predictions.length} picks`);
                }
            } catch (e) {
                console.error('[UNIFIED-FETCHER] NCAAF fetch error:', e.message);
                errors.push({ league: 'NCAAF', error: e.message });
            }
        }

        // ===== FINAL FALLBACK: DEMO DATA =====
        // If all APIs failed and we have no picks, provide demo data
        let fallbackUsed = false;
        if (allPicks.length === 0 && errors.length > 0) {
            console.warn('[UNIFIED-FETCHER] All APIs failed, falling back to demo data');
            allPicks = getDemoPicks();
            fallbackUsed = true;
        }

        console.log(`[UNIFIED-FETCHER] Total picks fetched: ${allPicks.length}`);

        return {
            picks: allPicks,
            errors: errors,
            date: date,
            timestamp: new Date().toISOString(),
            fallbackUsed: fallbackUsed
        };
    };

    /**
     * Fetch picks and add them to the weekly lineup table
     * @param {string} league - 'all', 'nba', 'ncaam', 'nfl', 'ncaaf'
     * @param {string} date - 'today', 'tomorrow', or 'YYYY-MM-DD' (default: 'today')
     */
    const fetchAndDisplayPicks = async function(league = 'all', date = 'today') {
        const result = await fetchPicks(league, date);

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

    // ===== DEMO DATA FALLBACK =====
    function getDemoPicks() {
        const now = new Date();
        const hour = 60 * 60 * 1000;

        return [
            // NBA Demo Picks
            {
                game: 'Los Angeles Lakers @ Golden State Warriors',
                time: '7:00 PM',
                sport: 'NBA',
                league: 'NBA',
                pick: 'Lakers',
                market: 'spread',
                line: '+4.5',
                odds: '-110',
                edge: '4.2%',
                confidence: 3,
                status: 'pending'
            },
            {
                game: 'Boston Celtics @ Miami Heat',
                time: '8:00 PM',
                sport: 'NBA',
                league: 'NBA',
                pick: 'Celtics',
                market: 'moneyline',
                line: '',
                odds: '-150',
                edge: '3.8%',
                confidence: 3,
                status: 'pending'
            },
            // NCAAM Demo Picks
            {
                game: 'Duke Blue Devils @ North Carolina Tar Heels',
                time: '6:00 PM',
                sport: 'NCAAB',
                league: 'NCAAM',
                pick: 'Duke',
                market: 'spread',
                line: '+2.5',
                odds: '-110',
                edge: '5.1%',
                confidence: 4,
                status: 'pending'
            },
            // NFL Demo Picks
            {
                game: 'Kansas City Chiefs @ Buffalo Bills',
                time: '1:00 PM',
                sport: 'NFL',
                league: 'NFL',
                pick: 'Chiefs',
                market: 'spread',
                line: '-3.5',
                odds: '-110',
                edge: '4.7%',
                confidence: 4,
                status: 'pending'
            },
            // NCAAF Demo Picks
            {
                game: 'Alabama Crimson Tide @ Georgia Bulldogs',
                time: '3:30 PM',
                sport: 'NCAAF',
                league: 'NCAAF',
                pick: 'Alabama',
                market: 'spread',
                line: '-6.5',
                odds: '-110',
                edge: '6.2%',
                confidence: 5,
                status: 'pending'
            }
        ];
    }

    // Export
    window.UnifiedPicksFetcher = {
        fetchPicks,
        fetchAndDisplayPicks,
        checkAllHealth
    };

    console.log('UnifiedPicksFetcher v1.1 loaded');

})();

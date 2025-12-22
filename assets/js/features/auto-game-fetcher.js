/**
 * Auto Game Fetcher v2.0
 * Automatically fetches today's games and validates pick games
 * Prevents betting on finished/invalid games
 * v2.0: Fetches standings for team records (W-L)
 */

(function() {
    'use strict';

    const SPORTSDATAIO_API_KEY = window.APP_CONFIG?.SPORTSDATAIO?.API_KEY || '';
    const todayISO = new Date().toISOString().split('T')[0];
    const todayESPN = todayISO.replace(/-/g, '');

    let todaysGamesCache = null;
    let teamRecordsCache = {};  // Map of team name -> record string
    let lastFetch = null;

    /**
     * Fetch from SportsDataIO
     */
    async function fetchSportsDataIO(sport) {
        if (!SPORTSDATAIO_API_KEY) {
            console.warn(`[AUTO-GAME-FETCHER] Missing SportsDataIO API key, skipping ${sport} fetch.`);
            return [];
        }

        const todaySportsDataIO = todayISO.replace(/-/g, '-').toUpperCase();
        const url = `https://api.sportsdata.io/v4/${sport}/scores/json/ScoresByDate/${todaySportsDataIO}`;
        
        const response = await fetch(url, {
            headers: {
                'Ocp-Apim-Subscription-Key': SPORTSDATAIO_API_KEY
            }
        });
        
        if (!response.ok) {
            throw new Error(`SportsDataIO ${sport} API error: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Fetch standings from ESPN to get team records
     */
    async function fetchStandings(sport) {
        const sportPath = sport === 'NBA' ? 'nba' :
                         sport === 'NFL' ? 'nfl' :
                         sport === 'NCAAM' ? 'mens-college-basketball' :
                         sport === 'NCAAF' ? 'college-football' : null;

        if (!sportPath) return;

        const sportCategory = sport === 'NBA' || sport === 'NCAAM' ? 'basketball' : 'football';
        const url = `https://site.api.espn.com/apis/v2/sports/${sportCategory}/${sportPath}/standings`;

        try {
            console.log(`[AUTO-GAME-FETCHER] Fetching ${sport} standings...`);
            const response = await fetch(url);
            if (!response.ok) return;

            const data = await response.json();
            
            // Parse standings - structure: children[].standings.entries[]
            const conferences = data.children || [];
            for (const conf of conferences) {
                const entries = conf.standings?.entries || [];
                for (const entry of entries) {
                    const teamName = entry.team?.displayName;
                    if (!teamName) continue;

                    const stats = entry.stats || [];
                    const winsObj = stats.find(s => s.name === 'wins');
                    const lossesObj = stats.find(s => s.name === 'losses');
                    
                    const wins = winsObj?.displayValue || winsObj?.value || '0';
                    const losses = lossesObj?.displayValue || lossesObj?.value || '0';
                    
                    teamRecordsCache[teamName.toLowerCase()] = `${wins}-${losses}`;
                }
            }
            console.log(`[AUTO-GAME-FETCHER] Loaded ${Object.keys(teamRecordsCache).length} team records for ${sport}`);
        } catch (e) {
            console.warn(`[AUTO-GAME-FETCHER] Could not fetch ${sport} standings:`, e.message);
        }
    }

    /**
     * Get team record from cache
     */
    function getTeamRecord(teamName) {
        if (!teamName) return '';
        const lower = teamName.toLowerCase();
        return teamRecordsCache[lower] || '';
    }

    /**
     * Fetch from ESPN API
     */
    async function fetchESPN(sport) {
        const sportPath = sport === 'NCAAM' ? 'mens-college-basketball' :
                         sport === 'NBA' ? 'nba' :
                         sport === 'NCAAF' ? 'college-football' :
                         sport === 'NFL' ? 'nfl' : null;

        if (!sportPath) throw new Error('Unknown sport');

        // Determine sport category for URL
        const sportCategory = sport === 'NBA' || sport === 'NCAAM' ? 'basketball' : 'football';

        // ESPN scoreboard expects YYYYMMDD format (no dashes)
        const dateStr = todayESPN;
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sportCategory}/${sportPath}/scoreboard?dates=${dateStr}`;

        console.log(`[AUTO-GAME-FETCHER] Fetching ${sport} from: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`ESPN ${sport} API error: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Parse ESPN games
     */
    function parseESPNGames(data, sport) {
        if (!data || !data.events || data.events.length === 0) {
            return [];
        }

        return data.events
            .map(event => {
                const competition = event.competitions?.[0];
                const competitors = competition?.competitors || [];

                const homeTeam = competitors.find(t => t.homeAway === 'home');
                const awayTeam = competitors.find(t => t.homeAway === 'away');

                // Skip malformed entries instead of throwing
                if (!competition || !homeTeam || !awayTeam) {
                    return null;
                }

                const status = competition.status || event.status || {};
                const statusType = status.type || {};

                const awayTeamName = awayTeam.team.displayName;
                const homeTeamName = homeTeam.team.displayName;

                return {
                    sport,
                    date: todayISO,
                    time: new Date(event.date).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }),
                    awayTeam: awayTeamName,
                    homeTeam: homeTeamName,
                    awayRecord: getTeamRecord(awayTeamName),
                    homeRecord: getTeamRecord(homeTeamName),
                    awayScore: parseInt(awayTeam.score, 10) || 0,
                    homeScore: parseInt(homeTeam.score, 10) || 0,
                    status: statusType.description || statusType.name || 'Scheduled',
                    statusDetail: statusType.detail || '',
                    gameId: event.id,
                    channel: competition.broadcasts?.[0]?.names?.[0] || 'TBD'
                };
            })
            .filter(Boolean);
    }

    /**
     * Fetch all today's games
     */
    async function fetchTodaysGames(forceRefresh = false) {
        // Use cache if fresh (within 60 seconds)
        if (!forceRefresh && todaysGamesCache && lastFetch && (Date.now() - lastFetch < 60000)) {
            return todaysGamesCache;
        }

        // FIRST: Fetch standings to get team records
        console.log('[AUTO-GAME-FETCHER] Fetching team standings for records...');
        await Promise.all([
            fetchStandings('NBA'),
            fetchStandings('NFL'),
            fetchStandings('NCAAM'),
            fetchStandings('NCAAF')
        ]);

        const allGames = [];

        try {
            console.log('[AUTO-GAME-FETCHER] Fetching NCAAM games...');
            const ncaamData = await fetchESPN('NCAAM');
            const ncaamGames = parseESPNGames(ncaamData, 'NCAAM');
            allGames.push(...ncaamGames);
            console.log(`[AUTO-GAME-FETCHER] Found ${ncaamGames.length} NCAAM games`);
        } catch (e) {
            console.error('[AUTO-GAME-FETCHER] Error fetching NCAAM:', e.message);
        }

        try {
            console.log('[AUTO-GAME-FETCHER] Fetching NBA games...');
            const nbaData = await fetchESPN('NBA');
            const nbaGames = parseESPNGames(nbaData, 'NBA');
            allGames.push(...nbaGames);
            console.log(`[AUTO-GAME-FETCHER] Found ${nbaGames.length} NBA games`);
        } catch (e) {
            console.error('[AUTO-GAME-FETCHER] Error fetching NBA:', e.message);
        }

        try {
            console.log('[AUTO-GAME-FETCHER] Fetching NFL games...');
            const nflData = await fetchESPN('NFL');
            const nflGames = parseESPNGames(nflData, 'NFL');
            allGames.push(...nflGames);
            console.log(`[AUTO-GAME-FETCHER] Found ${nflGames.length} NFL games`);
        } catch (e) {
            console.error('[AUTO-GAME-FETCHER] Error fetching NFL:', e.message);
        }

        try {
            console.log('[AUTO-GAME-FETCHER] Fetching NCAAF games...');
            const ncaafData = await fetchESPN('NCAAF');
            const ncaafGames = parseESPNGames(ncaafData, 'NCAAF');
            allGames.push(...ncaafGames);
            console.log(`[AUTO-GAME-FETCHER] Found ${ncaafGames.length} NCAAF games`);
        } catch (e) {
            console.error('[AUTO-GAME-FETCHER] Error fetching NCAAF:', e.message);
        }

        todaysGamesCache = allGames;
        lastFetch = Date.now();

        console.log(`[AUTO-GAME-FETCHER] Total games today: ${allGames.length}`);
        return allGames;
    }

    /**
     * Find game by team names
     */
    function findGame(teamName1, teamName2) {
        if (!todaysGamesCache) return null;

        const name1Lower = teamName1.toLowerCase();
        const name2Lower = teamName2 ? teamName2.toLowerCase() : null;

        return todaysGamesCache.find(game => {
            const awayLower = game.awayTeam.toLowerCase();
            const homeLower = game.homeTeam.toLowerCase();

            // Check if both teams match
            if (name2Lower) {
                return (awayLower.includes(name1Lower) && homeLower.includes(name2Lower)) ||
                       (awayLower.includes(name2Lower) && homeLower.includes(name1Lower));
            }

            // Check if single team matches
            return awayLower.includes(name1Lower) || homeLower.includes(name1Lower);
        });
    }

    /**
     * Check if game has started
     */
    function hasGameStarted(game) {
        if (!game) return false;
        const status = (game.status || '').toLowerCase();
        return !status.includes('scheduled') && !status.includes('pre');
    }

    /**
     * Check if game is finished
     */
    function isGameFinished(game) {
        if (!game) return false;
        const status = (game.status || '').toLowerCase();
        return status.includes('final') || status.includes('completed');
    }

    /**
     * Get game status message
     */
    function getGameStatusMessage(game) {
        if (!game) return 'Game not found for today';
        if (isGameFinished(game)) return `Game finished: ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore}`;
        if (hasGameStarted(game)) return `In progress: ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore}`;
        return `Scheduled for ${game.time}`;
    }

    // Auto-fetch on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            fetchTodaysGames().catch(console.error);
        });
    } else {
        fetchTodaysGames().catch(console.error);
    }

    // Refresh every 60 seconds
    setInterval(() => {
        fetchTodaysGames(true).catch(console.error);
    }, 60000);

    // Export
    window.AutoGameFetcher = {
        fetchTodaysGames,
        findGame,
        hasGameStarted,
        isGameFinished,
        getGameStatusMessage,
        getTodaysGames: () => todaysGamesCache,
        getTeamRecord,
        getRecordsCache: () => teamRecordsCache
    };

    console.log('✅ AutoGameFetcher v2.0 loaded (with standings)');

})();

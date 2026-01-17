/**
 * Auto Game Fetcher v2.2
 * Automatically fetches today's games and validates pick games
 * Prevents betting on finished/invalid games
 * v2.0: Fetches standings for team records (W-L)
 * v2.1: SportsDataIO as primary source for NFL/NCAAF (more accurate)
 * v2.2: Use Azure Functions proxy for SportsDataIO (avoids CORS)
 */

(function() {
    'use strict';

    // Use local time instead of UTC to match CST game schedules
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayESPN = todayISO.replace(/-/g, '');
    const STANDINGS_TTL_MS = 6 * 60 * 60 * 1000; // cache standings for 6 hours
    const SCOREBOARD_INTERVAL_INITIAL_MS = 180000; // 3 minutes
    const SCOREBOARD_INTERVAL_MAX_MS = 600000; // 10 minutes

    let todaysGamesCache = null;
    let teamRecordsCache = {};  // Map of team name -> record string
    let lastFetch = null;
    const lastStandingsFetch = {
        NBA: 0,
        NFL: 0,
        NCAAM: 0,
        NCAAF: 0
    };
    let scoreboardIntervalMs = SCOREBOARD_INTERVAL_INITIAL_MS;

    /**
     * Get the scoreboard proxy URL (Azure Functions)
     */
    function getScoreboardProxyUrl() {
        // Primary: API base (Front Door/custom domain)
        const apiBase = window.APP_CONFIG?.API_BASE_URL;
        if (apiBase) {
            const trimmed = apiBase.replace(/\/+$/, '');
            return `${trimmed}/scoreboard`;
        }

        // Secondary: Functions base (Front Door or direct)
        const functionsBase = window.APP_CONFIG?.FUNCTIONS_BASE_URL;
        if (functionsBase) {
            const trimmed = functionsBase.replace(/\/+$/, '');
            return `${trimmed}/api/scoreboard`;
        }

        // Fallback: relative path (won't work for SportsDataIO)
        return '/api/scoreboard';
    }

    /**
     * Fetch from SportsDataIO via Azure Functions proxy (avoids CORS)
     */
    async function fetchSportsDataIO(sport) {
        const proxyBase = getScoreboardProxyUrl();
        const url = `${proxyBase}/${sport}?date=${todayISO}`;

        console.log(`[AUTO-GAME-FETCHER] Fetching ${sport} via proxy: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Scoreboard proxy ${sport} error: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Fetch standings from ESPN to get team records
     */
    async function fetchStandings(sport) {
        const now = Date.now();
        if (lastStandingsFetch[sport] && now - lastStandingsFetch[sport] < STANDINGS_TTL_MS) {
            return;
        }

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
            lastStandingsFetch[sport] = now;
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
     * Parse SportsDataIO games into standard format
     */
    function parseSportsDataIOGames(games, sport) {
        if (!Array.isArray(games) || games.length === 0) {
            return [];
        }

        return games.map(game => {
            const awayTeamName = game.AwayTeam || game.AwayTeamName || '';
            const homeTeamName = game.HomeTeam || game.HomeTeamName || '';

            // Parse game time
            let gameTime = 'TBD';
            if (game.DateTime) {
                try {
                    gameTime = new Date(game.DateTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                } catch (e) {
                    gameTime = 'TBD';
                }
            }

            // Determine status from SportsDataIO Status field
            const sdStatus = (game.Status || '').toLowerCase();
            let status = 'Scheduled';
            let statusDetail = '';

            if (sdStatus === 'final' || sdStatus === 'f' || sdStatus === 'f/ot') {
                status = 'Final';
                statusDetail = sdStatus === 'f/ot' ? 'Final/OT' : 'Final';
            } else if (sdStatus === 'inprogress' || sdStatus === 'in progress') {
                status = 'In Progress';
                statusDetail = game.TimeRemaining ? `Q${game.Quarter} ${game.TimeRemaining}` : `Q${game.Quarter || 1}`;
            } else if (sdStatus === 'halftime') {
                status = 'Halftime';
                statusDetail = 'Halftime';
            } else if (sdStatus === 'postponed') {
                status = 'Postponed';
            } else if (sdStatus === 'canceled') {
                status = 'Canceled';
            }

            return {
                sport,
                date: todayISO,
                time: gameTime,
                awayTeam: awayTeamName,
                homeTeam: homeTeamName,
                awayRecord: getTeamRecord(awayTeamName),
                homeRecord: getTeamRecord(homeTeamName),
                awayScore: game.AwayScore || 0,
                homeScore: game.HomeScore || 0,
                status: status,
                statusDetail: statusDetail,
                gameId: String(game.GameID || game.ScoreID || ''),
                channel: game.Channel || 'TBD',
                source: 'sportsdata.io'
            };
        }).filter(g => g.awayTeam && g.homeTeam);
    }

    /**
     * Fetch all today's games
     */
    async function fetchTodaysGames(forceRefresh = false) {
        // Use cache if fresh (within 60 seconds)
        if (!forceRefresh && todaysGamesCache && lastFetch && (Date.now() - lastFetch < 60000)) {
            return todaysGamesCache;
        }

        // Feature flags for disabled leagues
        const disabledLeagues = new Set(window.APP_CONFIG?.WEEKLY_LINEUP_DISABLED_LEAGUES || window.WEEKLY_LINEUP_DISABLED_LEAGUES || ['NFL', 'NCAAF']); // Default disabled if not config
        const isEnabled = (league) => !disabledLeagues.has(league);

        // FIRST: Fetch standings (cached) to get team records
        console.log('[AUTO-GAME-FETCHER] Fetching team standings for records (cached)...');
        
        const standingsPromises = [];
        if (isEnabled('NBA')) standingsPromises.push(fetchStandings('NBA'));
        if (isEnabled('NFL')) standingsPromises.push(fetchStandings('NFL'));
        if (isEnabled('NCAAM')) standingsPromises.push(fetchStandings('NCAAM'));
        if (isEnabled('NCAAF')) standingsPromises.push(fetchStandings('NCAAF'));

        await Promise.all(standingsPromises);

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

        // NFL: SportsDataIO primary, ESPN fallback
        try {
            console.log('[AUTO-GAME-FETCHER] Fetching NFL games from SportsDataIO...');
            const nflSportsData = await fetchSportsDataIO('nfl');
            const nflGames = parseSportsDataIOGames(nflSportsData, 'NFL');
            if (nflGames.length > 0) {
                allGames.push(...nflGames);
                console.log(`[AUTO-GAME-FETCHER] Found ${nflGames.length} NFL games (SportsDataIO)`);
            } else {
                throw new Error('No games from SportsDataIO');
            }
        } catch (e) {
            console.warn(`[AUTO-GAME-FETCHER] SportsDataIO NFL failed (${e.message}), trying ESPN...`);
            try {
                const nflData = await fetchESPN('NFL');
                const nflGames = parseESPNGames(nflData, 'NFL');
                allGames.push(...nflGames);
                console.log(`[AUTO-GAME-FETCHER] Found ${nflGames.length} NFL games (ESPN fallback)`);
            } catch (e2) {
                console.error('[AUTO-GAME-FETCHER] Error fetching NFL from both sources:', e2.message);
            }
        }

        // NCAAF: SportsDataIO primary, ESPN fallback
        try {
            console.log('[AUTO-GAME-FETCHER] Fetching NCAAF games from SportsDataIO...');
            const ncaafSportsData = await fetchSportsDataIO('cfb');
            const ncaafGames = parseSportsDataIOGames(ncaafSportsData, 'NCAAF');
            if (ncaafGames.length > 0) {
                allGames.push(...ncaafGames);
                console.log(`[AUTO-GAME-FETCHER] Found ${ncaafGames.length} NCAAF games (SportsDataIO)`);
            } else {
                throw new Error('No games from SportsDataIO');
            }
        } catch (e) {
            console.warn(`[AUTO-GAME-FETCHER] SportsDataIO NCAAF failed (${e.message}), trying ESPN...`);
            try {
                const ncaafData = await fetchESPN('NCAAF');
                const ncaafGames = parseESPNGames(ncaafData, 'NCAAF');
                allGames.push(...ncaafGames);
                console.log(`[AUTO-GAME-FETCHER] Found ${ncaafGames.length} NCAAF games (ESPN fallback)`);
            } catch (e2) {
                console.error('[AUTO-GAME-FETCHER] Error fetching NCAAF from both sources:', e2.message);
            }
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

    async function scheduleScoreboardRefresh() {
        try {
            await fetchTodaysGames(true);
            scoreboardIntervalMs = SCOREBOARD_INTERVAL_INITIAL_MS;
        } catch (err) {
            console.error('[AUTO-GAME-FETCHER] Refresh failed:', err.message || err);
            scoreboardIntervalMs = Math.min(scoreboardIntervalMs * 2, SCOREBOARD_INTERVAL_MAX_MS);
        } finally {
            setTimeout(scheduleScoreboardRefresh, scoreboardIntervalMs);
        }
    }

    // Auto-fetch on load, then refresh with backoff
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            fetchTodaysGames().catch(console.error).finally(() => scheduleScoreboardRefresh());
        });
    } else {
        fetchTodaysGames().catch(console.error).finally(() => scheduleScoreboardRefresh());
    }

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

    console.log('✅ AutoGameFetcher v2.2 loaded - NFL/NCAAF: SportsDataIO via proxy | NBA/NCAAM: ESPN');

})();

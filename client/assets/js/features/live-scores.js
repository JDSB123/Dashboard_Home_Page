/**
 * Live Score Updates v2.1
 * Real-time score updates for active games without page refresh
 * v2.1: SportsDataIO as primary source for NFL/NCAAF box scores
 */

(function() {
    'use strict';

    class LiveScoreUpdater {
        constructor() {
            this.updateInterval = null;
            this.lastUpdate = Date.now();
            this.updateFrequency = 30000; // 30 seconds default
            this.isUpdating = false;
            this.activeGames = new Map();
            this.apiEndpoint = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : '/api';

            // Bind methods
            this.startLiveUpdates = this.startLiveUpdates.bind(this);
            this.stopLiveUpdates = this.stopLiveUpdates.bind(this);
            this.updateScores = this.updateScores.bind(this);
        }

        /**
         * Start live score updates
         */
        startLiveUpdates() {
            if (this.updateInterval) {
                return; // Already running
            }

            console.log('Starting live score updates');

            // Initial update
            this.updateScores();

            // Set up interval
            this.updateInterval = setInterval(() => {
                this.updateScores();
            }, this.updateFrequency);
        }

        /**
         * Stop live score updates
         */
        stopLiveUpdates() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
                console.log('Stopped live score updates');
            }
        }

        /**
         * Update scores for all active games
         */
        async updateScores() {
            if (this.isUpdating) {
                return; // Prevent overlapping updates
            }

            this.isUpdating = true;

            try {
                // Get all picks from the table
                const picks = this.getActivePicksFromDOM();

                if (picks.length === 0) {
                    this.isUpdating = false;
                    return;
                }

                // Group picks by sport
                const picksBySport = this.groupPicksBySport(picks);

                // Fetch updates for each sport
                for (const [sport, sportPicks] of Object.entries(picksBySport)) {
                    await this.updateSportScores(sport, sportPicks);
                }

                // Update KPI metrics
                this.updateKPIMetrics();

                this.lastUpdate = Date.now();
            } catch (error) {
                console.error('Error updating scores:', error);
            } finally {
                this.isUpdating = false;
            }
        }

        /**
         * Get active picks from DOM
         */
        getActivePicksFromDOM() {
            const picks = [];
            const tbody = document.getElementById('picks-tbody');

            if (!tbody) {
                return picks;
            }

            // Also check for tracker picks (same structure)
            if (picks.length === 0 && tbody.children.length === 0) {
                // No picks found, return empty
                return picks;
            }

            const rows = tbody.querySelectorAll('tr:not(.parlay-legs)');

            rows.forEach(row => {
                // Skip hidden rows
                if (row.style.display === 'none') {
                    return;
                }

                const status = row.querySelector('.status-badge')?.textContent || '';

                // Only update pending and live games
                if (status === 'Pending' || status === 'On Track' || status === 'At Risk') {
                    const pick = this.extractPickFromRow(row);
                    if (pick) {
                        picks.push(pick);
                    }
                }
            });

            return picks;
        }

        /**
         * Extract pick data from table row
         */
        extractPickFromRow(row) {
            try {
                const pick = {
                    rowId: row.getAttribute('data-row-id') || row.id,
                    gameId: row.getAttribute('data-game-id'),
                    sport: row.getAttribute('data-sport') || 'nfl',

                    // Teams
                    awayTeam: row.getAttribute('data-away-team'),
                    homeTeam: row.getAttribute('data-home-team'),
                    awayAbbr: row.getAttribute('data-away-abbr'),
                    homeAbbr: row.getAttribute('data-home-abbr'),

                    // Pick details
                    pickType: row.getAttribute('data-pick-type'),
                    pickTeam: row.getAttribute('data-pick-team'),
                    line: row.getAttribute('data-line'),

                    // Current scores (from box score if available)
                    currentAwayScore: null,
                    currentHomeScore: null
                };

                // Try to get current scores from box score (check both selectors)
                const boxScore = row.querySelector('.boxscore-container, .compact-boxscore');
                if (boxScore) {
                    // Try multiple selector patterns for totals
                    const awayTotal = boxScore.querySelector('.total-away, .boxscore-row:nth-child(2) .boxscore-cell.total');
                    const homeTotal = boxScore.querySelector('.total-home, .boxscore-row:nth-child(3) .boxscore-cell.total');

                    if (awayTotal) {
                        pick.currentAwayScore = parseInt(awayTotal.textContent) || 0;
                    }
                    if (homeTotal) {
                        pick.currentHomeScore = parseInt(homeTotal.textContent) || 0;
                    }
                }

                return pick;
            } catch (error) {
                console.warn('Failed to extract pick from row:', error);
                return null;
            }
        }

        /**
         * Group picks by sport
         */
        groupPicksBySport(picks) {
            const grouped = {};

            for (const pick of picks) {
                const sport = pick.sport || 'nfl';
                if (!grouped[sport]) {
                    grouped[sport] = [];
                }
                grouped[sport].push(pick);
            }

            return grouped;
        }

        /**
         * Get sport-specific API URL from config
         */
        getSportApiUrl(sport) {
            const sportUpper = sport.toUpperCase();
            const configKey = `${sportUpper}_API_URL`;
            
            // Try to get from ModelEndpointResolver first
            if (window.ModelEndpointResolver?.getApiEndpoint) {
                const resolvedEndpoint = window.ModelEndpointResolver.getApiEndpoint(sport);
                if (resolvedEndpoint) {
                    return resolvedEndpoint;
                }
            }
            
            // Fall back to APP_CONFIG
            if (window.APP_CONFIG && window.APP_CONFIG[configKey]) {
                return window.APP_CONFIG[configKey];
            }
            
            // Default fallbacks
            const defaults = {
                nba: 'https://www.greenbiersportventures.com/api/nba',
                ncaam: 'https://www.greenbiersportventures.com/api/ncaam',
                nfl: 'https://www.greenbiersportventures.com/api/nfl',
                ncaaf: 'https://www.greenbiersportventures.com/api/ncaaf'
            };
            
            return defaults[sport.toLowerCase()] || null;
        }

        /**
         * Update scores for a specific sport
         * NFL/NCAAF: SportsDataIO (primary) -> ESPN (fallback)
         * NBA/NCAAM: ESPN via AutoGameFetcher (primary) -> Direct ESPN (fallback)
         */
        async updateSportScores(sport, picks) {
            const sportUpper = sport.toUpperCase();

            try {
                // NFL and NCAAF: Use SportsDataIO as primary source (more accurate for football)
                if (sportUpper === 'NFL' || sportUpper === 'NCAAF') {
                    const success = await this.fetchSportsDataIOScores(sport, picks);
                    if (success) return;

                    // Fallback to ESPN for NFL/NCAAF
                    console.log(`[LIVE-SCORES] SportsDataIO failed for ${sport}, falling back to ESPN`);
                }

                // NBA and NCAAM: Use AutoGameFetcher's cached ESPN data (primary)
                if (window.AutoGameFetcher) {
                    const allGames = window.AutoGameFetcher.getTodaysGames() || [];
                    const sportGames = allGames.filter(g => g.sport?.toUpperCase() === sportUpper);

                    if (sportGames.length > 0) {
                        console.log(`[LIVE-SCORES] Using ESPN data for ${sport} (${sportGames.length} games)`);

                        // Update each pick with matching game data
                        for (const pick of picks) {
                            const game = this.findMatchingGame(pick, sportGames);
                            if (game) {
                                // Convert ESPN format to our expected format
                                const normalizedGame = {
                                    gameId: game.gameId,
                                    awayTeam: game.awayTeam,
                                    homeTeam: game.homeTeam,
                                    awayScore: game.awayScore || 0,
                                    homeScore: game.homeScore || 0,
                                    isLive: game.status && !game.status.toLowerCase().includes('scheduled') && !game.status.toLowerCase().includes('final'),
                                    isFinal: game.status?.toLowerCase().includes('final'),
                                    gameStatus: {
                                        clock: game.statusDetail || game.status,
                                        period: this.extractPeriod(game.status)
                                    }
                                };
                                this.updatePickWithGameData(pick, normalizedGame);
                            }
                        }
                        return; // Success - no need for fallback
                    }
                }

                // Fallback: Try direct ESPN fetch if AutoGameFetcher not available
                await this.fetchESPNScores(sport, picks);
            } catch (error) {
                console.warn(`[LIVE-SCORES] Failed to update ${sport} scores:`, error.message);
            }
        }

        /**
         * Fetch scores from SportsDataIO (primary for NFL/NCAAF)
         * Returns true if successful, false if should fallback to ESPN
         */
        async fetchSportsDataIOScores(sport, picks) {
            const apiKey = window.APP_CONFIG?.SPORTSDATAIO?.API_KEY;
            if (!apiKey) {
                console.warn(`[LIVE-SCORES] Missing SportsDataIO API key for ${sport}`);
                return false;
            }

            // SportsDataIO uses lowercase sport paths
            const sportPath = sport.toLowerCase();
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

            const url = `https://api.sportsdata.io/v4/${sportPath}/scores/json/ScoresByDate/${today}`;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Ocp-Apim-Subscription-Key': apiKey
                    }
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`[LIVE-SCORES] SportsDataIO ${sport} returned ${response.status}`);
                    return false;
                }

                const games = await response.json();
                if (!Array.isArray(games) || games.length === 0) {
                    console.log(`[LIVE-SCORES] No SportsDataIO games for ${sport} today`);
                    return false;
                }

                console.log(`[LIVE-SCORES] SportsDataIO returned ${games.length} ${sport} games`);

                for (const pick of picks) {
                    for (const sdGame of games) {
                        // SportsDataIO uses AwayTeam/HomeTeam or AwayTeamName/HomeTeamName
                        const awayTeam = sdGame.AwayTeam || sdGame.AwayTeamName || '';
                        const homeTeam = sdGame.HomeTeam || sdGame.HomeTeamName || '';

                        if (this.teamMatches(pick.awayTeam, awayTeam) &&
                            this.teamMatches(pick.homeTeam, homeTeam)) {

                            // Determine game status from SportsDataIO Status field
                            const status = (sdGame.Status || '').toLowerCase();
                            const isScheduled = status === 'scheduled' || status === 'pregame';
                            const isFinal = status === 'final' || status === 'f' || status === 'f/ot';
                            const isLive = !isScheduled && !isFinal && status !== 'postponed' && status !== 'canceled';

                            // Build quarter/period scoring if available
                            const scoring = {};
                            if (sdGame.Quarters && Array.isArray(sdGame.Quarters)) {
                                sdGame.Quarters.forEach((q, idx) => {
                                    const periodKey = `q${idx + 1}`;
                                    scoring[periodKey] = {
                                        away: q.AwayScore || 0,
                                        home: q.HomeScore || 0
                                    };
                                });
                            }

                            const game = {
                                gameId: sdGame.GameID || sdGame.ScoreID,
                                awayTeam: awayTeam,
                                homeTeam: homeTeam,
                                awayScore: sdGame.AwayScore || 0,
                                homeScore: sdGame.HomeScore || 0,
                                isLive: isLive,
                                isFinal: isFinal,
                                scoring: scoring,
                                gameStatus: {
                                    clock: sdGame.TimeRemaining || sdGame.Quarter || status,
                                    period: sdGame.Quarter || 1
                                }
                            };

                            this.updatePickWithGameData(pick, game);
                            break;
                        }
                    }
                }

                return true; // Successfully processed
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn(`[LIVE-SCORES] SportsDataIO ${sport} request timed out`);
                } else {
                    console.warn(`[LIVE-SCORES] SportsDataIO ${sport} error:`, error.message);
                }
                return false;
            }
        }

        /**
         * Extract period number from ESPN status string
         */
        extractPeriod(status) {
            if (!status) return 1;
            const match = status.match(/(\d+)(st|nd|rd|th)/i);
            return match ? parseInt(match[1]) : 1;
        }

        /**
         * Fallback: Fetch directly from ESPN API
         */
        async fetchESPNScores(sport, picks) {
            const sportPath = sport.toLowerCase() === 'ncaam' ? 'mens-college-basketball' :
                             sport.toLowerCase() === 'ncaaf' ? 'college-football' :
                             sport.toLowerCase();

            const sportCategory = sport.toLowerCase() === 'nba' || sport.toLowerCase() === 'ncaam' ? 'basketball' : 'football';
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

            const url = `https://site.api.espn.com/apis/site/v2/sports/${sportCategory}/${sportPath}/scoreboard?dates=${today}`;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) return;

                const data = await response.json();
                const events = data.events || [];

                for (const pick of picks) {
                    for (const event of events) {
                        const competition = event.competitions?.[0];
                        if (!competition) continue;

                        const competitors = competition.competitors || [];
                        const homeTeam = competitors.find(t => t.homeAway === 'home');
                        const awayTeam = competitors.find(t => t.homeAway === 'away');

                        if (!homeTeam || !awayTeam) continue;

                        // Check if this event matches the pick
                        if (this.teamMatches(pick.awayTeam, awayTeam.team.displayName) &&
                            this.teamMatches(pick.homeTeam, homeTeam.team.displayName)) {

                            const status = competition.status?.type || {};
                            const game = {
                                gameId: event.id,
                                awayTeam: awayTeam.team.displayName,
                                homeTeam: homeTeam.team.displayName,
                                awayScore: parseInt(awayTeam.score) || 0,
                                homeScore: parseInt(homeTeam.score) || 0,
                                isLive: status.state === 'in',
                                isFinal: status.completed === true,
                                gameStatus: {
                                    clock: status.detail || status.description,
                                    period: status.period || 1
                                }
                            };

                            this.updatePickWithGameData(pick, game);
                            break;
                        }
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.warn(`[LIVE-SCORES] ESPN fallback failed for ${sport}:`, error.message);
                }
            }
        }

        /**
         * Find matching game for a pick
         */
        findMatchingGame(pick, games) {
            for (const game of games) {
                // Match by game ID if available
                if (pick.gameId && game.gameId === pick.gameId) {
                    return game;
                }

                // Match by team abbreviations
                const awayMatch = this.teamMatches(pick.awayAbbr, game.awayAbbr) ||
                                  this.teamMatches(pick.awayTeam, game.awayTeam);
                const homeMatch = this.teamMatches(pick.homeAbbr, game.homeAbbr) ||
                                  this.teamMatches(pick.homeTeam, game.homeTeam);

                if (awayMatch && homeMatch) {
                    return game;
                }
            }

            return null;
        }

        /**
         * Check if team names match
         */
        teamMatches(team1, team2) {
            if (!team1 || !team2) return false;

            const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalize(team1) === normalize(team2);
        }

        /**
         * Update pick with live game data
         */
        updatePickWithGameData(pick, game) {
            const row = document.querySelector(`tr[data-row-id="${pick.rowId}"]`);
            if (!row) return;

            // Update box score if present (check both selectors)
            const boxScore = row.querySelector('.boxscore-container, .compact-boxscore');
            if (boxScore) {
                this.updateBoxScore(boxScore, game);
            }

            // Update status
            const newStatus = this.calculatePickStatus(pick, game);
            this.updatePickStatus(row, newStatus);

            // Store game in active games map
            this.activeGames.set(pick.rowId, game);
        }

        /**
         * Update box score display
         */
        updateBoxScore(boxScore, game) {
            // Update quarter scores
            if (game.scoring) {
                for (const [period, scores] of Object.entries(game.scoring)) {
                    const awayCell = boxScore.querySelector(`.${period.toLowerCase()}-away`);
                    const homeCell = boxScore.querySelector(`.${period.toLowerCase()}-home`);

                    if (awayCell && scores.away !== undefined) {
                        awayCell.textContent = scores.away;
                    }
                    if (homeCell && scores.home !== undefined) {
                        homeCell.textContent = scores.home;
                    }
                }
            }

            // Update total scores
            const awayTotal = boxScore.querySelector('.total-away');
            const homeTotal = boxScore.querySelector('.total-home');

            if (awayTotal && game.awayScore !== undefined) {
                awayTotal.textContent = game.awayScore;
            }
            if (homeTotal && game.homeScore !== undefined) {
                homeTotal.textContent = game.homeScore;
            }

            // Update game status
            const gameStatus = boxScore.querySelector('.game-time-status');
            if (gameStatus) {
                if (game.isLive) {
                    gameStatus.textContent = game.gameStatus?.clock || 'Live';
                    gameStatus.className = 'game-time-status live';
                } else if (game.isFinal) {
                    gameStatus.textContent = 'Final';
                    gameStatus.className = 'game-time-status final';
                } else {
                    // Keep existing status for pending/loading states
                    // The skeleton should remain visible with current status
                    gameStatus.className = 'game-time-status countdown';
                }
            }

            if (boxScore && boxScore.getAttribute('data-live-ready') !== 'true') {
                boxScore.setAttribute('data-live-ready', 'true');
            }
        }

        /**
         * Calculate pick status based on game data
         */
        calculatePickStatus(pick, game) {
            if (game.isFinal) {
                return this.calculateFinalStatus(pick, game);
            } else if (game.isLive) {
                return this.calculateLiveStatus(pick, game);
            }

            return 'pending';
        }

        /**
         * Calculate final status for completed game
         */
        calculateFinalStatus(pick, game) {
            const awayScore = game.awayScore || 0;
            const homeScore = game.homeScore || 0;

            if (pick.pickType === 'spread') {
                const spread = parseFloat(pick.line) || 0;
                const isAwayPick = this.teamMatches(pick.pickTeam, pick.awayTeam);
                const actualSpread = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);

                if (actualSpread + spread > 0) {
                    return 'win';
                } else if (actualSpread + spread < 0) {
                    return 'loss';
                } else {
                    return 'push';
                }
            } else if (pick.pickType === 'moneyline') {
                const isAwayPick = this.teamMatches(pick.pickTeam, pick.awayTeam);
                const pickScore = isAwayPick ? awayScore : homeScore;
                const oppScore = isAwayPick ? homeScore : awayScore;

                if (pickScore > oppScore) {
                    return 'win';
                } else if (pickScore < oppScore) {
                    return 'loss';
                } else {
                    return 'push';
                }
            } else if (pick.pickType === 'total' || pick.pickType.includes('ou')) {
                const total = parseFloat(pick.line) || 0;
                const actualTotal = awayScore + homeScore;
                const isOver = pick.pickType.includes('over') || pick.pickTeam?.toLowerCase().includes('over');

                if (isOver) {
                    return actualTotal > total ? 'win' : (actualTotal < total ? 'loss' : 'push');
                } else {
                    return actualTotal < total ? 'win' : (actualTotal > total ? 'loss' : 'push');
                }
            }

            return 'pending';
        }

        /**
         * Calculate live status for in-progress game
         */
        calculateLiveStatus(pick, game) {
            const awayScore = game.awayScore || 0;
            const homeScore = game.homeScore || 0;

            if (pick.pickType === 'spread') {
                const spread = parseFloat(pick.line) || 0;
                const isAwayPick = this.teamMatches(pick.pickTeam, pick.awayTeam);
                const actualSpread = isAwayPick ? (awayScore - homeScore) : (homeScore - awayScore);

                return (actualSpread + spread > 0) ? 'on-track' : 'at-risk';
            } else if (pick.pickType === 'moneyline') {
                const isAwayPick = this.teamMatches(pick.pickTeam, pick.awayTeam);
                const pickScore = isAwayPick ? awayScore : homeScore;
                const oppScore = isAwayPick ? homeScore : awayScore;

                return pickScore >= oppScore ? 'on-track' : 'at-risk';
            } else if (pick.pickType === 'total' || pick.pickType.includes('ou')) {
                const total = parseFloat(pick.line) || 0;
                const actualTotal = awayScore + homeScore;
                const isOver = pick.pickType.includes('over') || pick.pickTeam?.toLowerCase().includes('over');

                // Estimate pace based on game progress
                const period = game.gameStatus?.period || 1;
                const projectedTotal = actualTotal * (4 / period);

                if (isOver) {
                    return projectedTotal > total ? 'on-track' : 'at-risk';
                } else {
                    return projectedTotal < total ? 'on-track' : 'at-risk';
                }
            }

            return 'pending';
        }

        /**
         * Update pick status badge
         */
        updatePickStatus(row, newStatus) {
            const statusBadge = row.querySelector('.status-badge');
            if (!statusBadge) return;

            const currentStatus = statusBadge.getAttribute('data-status');
            if (currentStatus === newStatus) return; // No change

            // Update badge
            statusBadge.setAttribute('data-status', newStatus);
            statusBadge.className = `status-badge status-${newStatus}`;
            statusBadge.textContent = this.getStatusLabel(newStatus);

            // Add animation for status change
            statusBadge.style.animation = 'pulse 0.5s ease';
            setTimeout(() => {
                statusBadge.style.animation = '';
            }, 500);

            // Persist FINAL statuses to localStorage (win/loss/push)
            // This ensures the archive system can read correct outcomes
            if (['win', 'loss', 'push'].includes(newStatus)) {
                this.persistStatusToStorage(row, newStatus);
            }
        }

        /**
         * Persist final status to localStorage for archive tracking
         */
        persistStatusToStorage(row, status) {
            try {
                const pickId = row.getAttribute('data-pick-id') || row.getAttribute('data-row-id');
                if (!pickId) return;

                const STORAGE_KEY = 'gbsv_picks';
                const picks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

                let updated = false;
                const updatedPicks = picks.map(p => {
                    // Match by ID or by row-id pattern
                    if (p.id === pickId || p.id?.includes(pickId) || pickId?.includes(p.id)) {
                        if (p.status !== status) {
                            updated = true;
                            return { ...p, status: status, finalizedAt: new Date().toISOString() };
                        }
                    }
                    return p;
                });

                if (updated) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPicks));
                    console.log(`[LIVE-SCORES] Persisted status '${status}' for pick ${pickId}`);
                }
            } catch (e) {
                console.error('[LIVE-SCORES] Error persisting status:', e);
            }
        }

        /**
         * Get status label
         */
        getStatusLabel(status) {
            const labels = {
                'pending': 'Pending',
                'on-track': 'On Track',
                'at-risk': 'At Risk',
                'win': 'Win',
                'loss': 'Loss',
                'push': 'Push'
            };

            return labels[status] || status;
        }

        /**
         * Get sport-specific API URL from config (kept for compatibility)
         * Note: Now primarily using ESPN via AutoGameFetcher
         */

        /**
         * Update KPI metrics
         */
        updateKPIMetrics() {
            // Trigger KPI recalculation if the function exists
            if (typeof window.recalculateKPIs === 'function') {
                window.recalculateKPIs();
            }

            // Or manually update KPI tiles
            const tiles = document.querySelectorAll('.kpi-tile');
            tiles.forEach(tile => {
                // Trigger tile update logic
                const event = new CustomEvent('update-kpi');
                tile.dispatchEvent(event);
            });
        }

        /**
         * Set update frequency
         */
        setUpdateFrequency(seconds) {
            this.updateFrequency = seconds * 1000;

            // Restart updates if running
            if (this.updateInterval) {
                this.stopLiveUpdates();
                this.startLiveUpdates();
            }
        }
    }

    // Create singleton instance
    const liveUpdater = new LiveScoreUpdater();

    // Export to global scope
    window.LiveScoreUpdater = liveUpdater;

    // Auto-start on page load if enabled
    document.addEventListener('DOMContentLoaded', () => {
        // Check if live updates are enabled in config
        const liveUpdatesEnabled = window.APP_CONFIG?.LIVE_UPDATES !== false;

        if (liveUpdatesEnabled) {
            // Start updates after a short delay to let the page fully load
            setTimeout(() => {
                liveUpdater.startLiveUpdates();
            }, 2000);
        }
    });

    // Stop updates when page is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            liveUpdater.stopLiveUpdates();
        } else {
            liveUpdater.startLiveUpdates();
        }
    });

    console.log('[LIVE-SCORES] v2.1 loaded - NFL/NCAAF: SportsDataIO (primary) | NBA/NCAAM: ESPN');
})();
/**
 * Live Score Updates
 * Real-time score updates for active games without page refresh
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
         */
        async updateSportScores(sport, picks) {
            try {
                // Get sport-specific API URL
                const sportApiUrl = this.getSportApiUrl(sport);
                
                if (!sportApiUrl) {
                    console.warn(`[LIVE-SCORES] No API endpoint configured for ${sport}`);
                    return;
                }
                
                // Use sport-specific scores endpoint
                // Most Container Apps expose /scores or /live-scores endpoint
                const endpoint = `${sportApiUrl}/scores`;

                // Fetch latest scores with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(endpoint, { 
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    // Scores endpoint may not exist for all sports - fail silently
                    if (response.status === 404) {
                        console.log(`[LIVE-SCORES] Scores endpoint not available for ${sport}`);
                        return;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                const games = data.data?.games || data.games || data || [];

                // Update each pick with matching game data
                for (const pick of picks) {
                    const game = this.findMatchingGame(pick, games);
                    if (game) {
                        this.updatePickWithGameData(pick, game);
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn(`[LIVE-SCORES] Request timeout for ${sport} scores`);
                } else {
                    console.warn(`[LIVE-SCORES] Failed to update ${sport} scores:`, error.message);
                }

                // Try fallback to odds API if available
                await this.fallbackToOddsAPI(sport, picks);
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
         * Fallback to odds API
         */
        async fallbackToOddsAPI(sport, picks) {
            // Implementation for fallback to odds API if main score API fails
            console.log(`Attempting fallback to odds API for ${sport}`);
        }

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

    console.log('Live score updater initialized');
})();
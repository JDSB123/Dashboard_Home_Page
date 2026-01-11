/**
 * Sportsbook API Integration v1.0.0
 * Connects to sportsbook APIs to fetch placed bets for tracking
 * Supports multiple sportsbooks with modular adapters
 */

(function() {
    'use strict';

    const getApiBase = () => window.APP_CONFIG?.FUNCTIONS_BASE_URL || '';

    class SportsbookConnector {
        constructor() {
            this.connectedBooks = new Map();
            this.adapters = {};
            this.initialized = false;
        }

        /**
         * Initialize connector
         */
        init() {
            if (this.initialized) return;

            // Register built-in adapters
            this._registerAdapters();

            // Load saved connections
            this._loadConnections();

            this.initialized = true;
            console.log('📚 Sportsbook Connector initialized');
        }

        /**
         * Register sportsbook adapters
         */
        _registerAdapters() {
            // Each adapter knows how to connect and fetch bets from a specific sportsbook
            this.adapters = {
                'draftkings': {
                    name: 'DraftKings',
                    logo: '/assets/sportsbooks/draftkings.png',
                    authType: 'oauth', // or 'credentials' or 'api_key'
                    fetchBets: (auth) => this._fetchDraftKingsBets(auth),
                    parseBet: (raw) => this._parseDraftKingsBet(raw)
                },
                'fanduel': {
                    name: 'FanDuel',
                    logo: '/assets/sportsbooks/fanduel.png',
                    authType: 'oauth',
                    fetchBets: (auth) => this._fetchFanDuelBets(auth),
                    parseBet: (raw) => this._parseFanDuelBet(raw)
                },
                'betmgm': {
                    name: 'BetMGM',
                    logo: '/assets/sportsbooks/betmgm.png',
                    authType: 'credentials',
                    fetchBets: (auth) => this._fetchBetMGMBets(auth),
                    parseBet: (raw) => this._parseBetMGMBet(raw)
                },
                'caesars': {
                    name: 'Caesars',
                    logo: '/assets/sportsbooks/caesars.png',
                    authType: 'credentials',
                    fetchBets: (auth) => this._fetchCaesarsBets(auth),
                    parseBet: (raw) => this._parseCaesarsBet(raw)
                },
                'pointsbet': {
                    name: 'PointsBet',
                    logo: '/assets/sportsbooks/pointsbet.png',
                    authType: 'credentials',
                    fetchBets: (auth) => this._fetchPointsBetBets(auth),
                    parseBet: (raw) => this._parsePointsBetBet(raw)
                },
                'action_network': {
                    name: 'Action Network',
                    logo: '/assets/sportsbooks/actionnetwork.png',
                    authType: 'credentials',
                    fetchBets: (auth) => this._fetchActionNetworkBets(auth),
                    parseBet: (raw) => this._parseActionNetworkBet(raw)
                }
            };
        }

        /**
         * Load saved sportsbook connections from localStorage
         */
        _loadConnections() {
            try {
                const saved = localStorage.getItem('gbsv_sportsbook_connections');
                if (saved) {
                    const connections = JSON.parse(saved);
                    connections.forEach(conn => {
                        this.connectedBooks.set(conn.bookId, {
                            ...conn,
                            lastSync: conn.lastSync ? new Date(conn.lastSync) : null
                        });
                    });
                }
            } catch (e) {
                console.error('Failed to load sportsbook connections:', e);
            }
        }

        /**
         * Save connections to localStorage
         */
        _saveConnections() {
            try {
                const connections = Array.from(this.connectedBooks.values());
                localStorage.setItem('gbsv_sportsbook_connections', JSON.stringify(connections));
            } catch (e) {
                console.error('Failed to save sportsbook connections:', e);
            }
        }

        /**
         * Get list of available sportsbooks
         */
        getAvailableBooks() {
            return Object.entries(this.adapters).map(([id, adapter]) => ({
                id,
                name: adapter.name,
                logo: adapter.logo,
                authType: adapter.authType,
                connected: this.connectedBooks.has(id)
            }));
        }

        /**
         * Get connected sportsbooks
         */
        getConnectedBooks() {
            return Array.from(this.connectedBooks.values());
        }

        /**
         * Connect to a sportsbook
         */
        async connect(bookId, credentials) {
            const adapter = this.adapters[bookId];
            if (!adapter) {
                throw new Error(`Unknown sportsbook: ${bookId}`);
            }

            // For OAuth, redirect to auth flow
            if (adapter.authType === 'oauth') {
                return this._initiateOAuth(bookId);
            }

            // For credentials, validate via server
            const response = await fetch(`${getApiBase()}/api/sportsbook/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookId, credentials })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to connect');
            }

            const result = await response.json();

            // Store connection (without actual credentials)
            this.connectedBooks.set(bookId, {
                bookId,
                name: adapter.name,
                connectedAt: new Date().toISOString(),
                lastSync: null,
                token: result.token // Encrypted token from server
            });

            this._saveConnections();

            window.dispatchEvent(new CustomEvent('sportsbook:connected', {
                detail: { bookId, name: adapter.name }
            }));

            return result;
        }

        /**
         * Disconnect from a sportsbook
         */
        disconnect(bookId) {
            if (this.connectedBooks.has(bookId)) {
                this.connectedBooks.delete(bookId);
                this._saveConnections();

                window.dispatchEvent(new CustomEvent('sportsbook:disconnected', {
                    detail: { bookId }
                }));
            }
        }

        /**
         * Fetch bets from a connected sportsbook
         */
        async fetchBets(bookId, options = {}) {
            const connection = this.connectedBooks.get(bookId);
            if (!connection) {
                throw new Error(`Not connected to ${bookId}`);
            }

            const response = await fetch(`${getApiBase()}/api/sportsbook/bets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId,
                    token: connection.token,
                    dateRange: options.dateRange || 'week',
                    status: options.status || 'all' // open, settled, all
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch bets');
            }

            const data = await response.json();
            const adapter = this.adapters[bookId];

            // Parse bets using adapter
            const bets = (data.bets || []).map(raw => adapter.parseBet(raw));

            // Update last sync time
            connection.lastSync = new Date().toISOString();
            this._saveConnections();

            return bets;
        }

        /**
         * Fetch bets from all connected sportsbooks
         */
        async fetchAllBets(options = {}) {
            const allBets = [];

            for (const [bookId, connection] of this.connectedBooks) {
                try {
                    const bets = await this.fetchBets(bookId, options);
                    allBets.push(...bets.map(b => ({ ...b, source: bookId })));
                } catch (error) {
                    console.error(`Failed to fetch from ${bookId}:`, error);
                }
            }

            // Sort by date
            allBets.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));

            return allBets;
        }

        /**
         * Sync bets to dashboard
         */
        async syncToDashboard(bets) {
            if (!bets || bets.length === 0) return [];

            const added = [];

            for (const bet of bets) {
                // Convert to standard pick format
                const pick = this._convertToPickFormat(bet);

                // Add to dashboard
                if (window.LocalPicksManager) {
                    try {
                        await window.LocalPicksManager.addPick(pick);
                        added.push(pick);
                    } catch (e) {
                        console.error('Failed to add bet to dashboard:', e);
                    }
                }
            }

            return added;
        }

        /**
         * Convert sportsbook bet to standard pick format
         */
        _convertToPickFormat(bet) {
            return {
                id: `${bet.source}-${bet.betId}`,
                source: bet.source,
                league: bet.league,
                gameDate: bet.gameDate,
                gameTime: bet.gameTime,
                awayTeam: bet.awayTeam,
                homeTeam: bet.homeTeam,
                pick: bet.selection,
                odds: bet.odds,
                risk: bet.stake,
                toWin: bet.potentialWin,
                outcome: bet.outcome,
                sportsbook: bet.source,
                placedAt: bet.placedAt,
                settledAt: bet.settledAt
            };
        }

        /**
         * Initiate OAuth flow
         */
        _initiateOAuth(bookId) {
            const returnUrl = encodeURIComponent(window.location.href);
            window.location.href = `${getApiBase()}/api/sportsbook/oauth/${bookId}?redirect=${returnUrl}`;
        }

        // ===== ADAPTER IMPLEMENTATIONS =====
        // These would be fleshed out with actual API integrations

        async _fetchActionNetworkBets(auth) {
            // Action Network sync via their API
            return [];
        }

        _parseActionNetworkBet(raw) {
            return {
                betId: raw.id,
                league: raw.sport?.toUpperCase(),
                awayTeam: raw.away_team,
                homeTeam: raw.home_team,
                selection: raw.pick_label,
                odds: raw.odds,
                stake: raw.risk,
                potentialWin: raw.to_win,
                outcome: raw.result,
                placedAt: raw.created_at,
                settledAt: raw.settled_at,
                gameDate: raw.game_date,
                gameTime: raw.game_time
            };
        }

        // Additional parsers would follow similar patterns...
    }

    // Create singleton
    window.SportsbookConnector = new SportsbookConnector();

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.SportsbookConnector.init());
    } else {
        window.SportsbookConnector.init();
    }

})();

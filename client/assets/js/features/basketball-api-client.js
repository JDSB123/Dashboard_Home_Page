/**
 * Basketball API Client v1.0.0
 * Secondary data source for NBA and NCAAM
 * Uses API key from Azure Key Vault via Azure Functions proxy
 */

(function() {
    'use strict';

    // Proxy through Azure Functions to keep API key server-side
    const getProxyEndpoint = () => {
        const base = window.APP_CONFIG?.FUNCTIONS_BASE_URL || '';
        return `${base}/api/basketball-api`;
    };

    class BasketballAPIClient {
        constructor() {
            this.baseUrl = getProxyEndpoint();
            this.cache = new Map();
            this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        }

        /**
         * Get NBA games for a specific date
         * @param {string} date - Date in YYYY-MM-DD format
         */
        async getNBAGames(date) {
            const cacheKey = `nba-games-${date}`;
            
            if (this._isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey).data;
            }

            try {
                const response = await fetch(`${this.baseUrl}/nba/games?date=${date}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch NBA games: ${response.status}`);
                }

                const data = await response.json();
                this._setCache(cacheKey, data);
                return data;

            } catch (error) {
                console.error('Basketball API - NBA games error:', error);
                return null;
            }
        }

        /**
         * Get NCAAM games for a specific date
         * @param {string} date - Date in YYYY-MM-DD format
         */
        async getNCAAMGames(date) {
            const cacheKey = `ncaam-games-${date}`;
            
            if (this._isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey).data;
            }

            try {
                const response = await fetch(`${this.baseUrl}/ncaam/games?date=${date}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch NCAAM games: ${response.status}`);
                }

                const data = await response.json();
                this._setCache(cacheKey, data);
                return data;

            } catch (error) {
                console.error('Basketball API - NCAAM games error:', error);
                return null;
            }
        }

        /**
         * Get live scores for a specific game
         * @param {string} gameId - Game ID
         * @param {string} league - 'nba' or 'ncaam'
         */
        async getLiveScore(gameId, league = 'nba') {
            try {
                const response = await fetch(`${this.baseUrl}/${league}/game/${gameId}/live`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch live score: ${response.status}`);
                }

                return await response.json();

            } catch (error) {
                console.error('Basketball API - Live score error:', error);
                return null;
            }
        }

        /**
         * Get team standings
         * @param {string} league - 'nba' or 'ncaam'
         * @param {string} season - Season year (e.g., '2025')
         */
        async getStandings(league = 'nba', season = String(new Date().getFullYear())) {
            const cacheKey = `${league}-standings-${season}`;
            
            if (this._isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey).data;
            }

            try {
                const response = await fetch(`${this.baseUrl}/${league}/standings?season=${season}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch standings: ${response.status}`);
                }

                const data = await response.json();
                this._setCache(cacheKey, data);
                return data;

            } catch (error) {
                console.error('Basketball API - Standings error:', error);
                return null;
            }
        }

        /**
         * Get team statistics
         * @param {string} teamId - Team ID
         * @param {string} league - 'nba' or 'ncaam'
         */
        async getTeamStats(teamId, league = 'nba') {
            const cacheKey = `${league}-team-${teamId}`;
            
            if (this._isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey).data;
            }

            try {
                const response = await fetch(`${this.baseUrl}/${league}/team/${teamId}/stats`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch team stats: ${response.status}`);
                }

                const data = await response.json();
                this._setCache(cacheKey, data);
                return data;

            } catch (error) {
                console.error('Basketball API - Team stats error:', error);
                return null;
            }
        }

        /**
         * Get odds for upcoming games
         * @param {string} league - 'nba' or 'ncaam'
         */
        async getOdds(league = 'nba') {
            try {
                const response = await fetch(`${this.baseUrl}/${league}/odds`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch odds: ${response.status}`);
                }

                return await response.json();

            } catch (error) {
                console.error('Basketball API - Odds error:', error);
                return null;
            }
        }

        /**
         * Check if cache entry is valid
         */
        _isCacheValid(key) {
            const entry = this.cache.get(key);
            if (!entry) return false;
            return Date.now() - entry.timestamp < this.cacheExpiry;
        }

        /**
         * Set cache entry
         */
        _setCache(key, data) {
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });
        }

        /**
         * Clear all cached data
         */
        clearCache() {
            this.cache.clear();
        }

        /**
         * Test API connectivity
         */
        async testConnection() {
            try {
                const response = await fetch(`${this.baseUrl}/health`);
                return response.ok;
            } catch (error) {
                return false;
            }
        }
    }

    // Create singleton instance
    window.BasketballAPIClient = new BasketballAPIClient();

})();

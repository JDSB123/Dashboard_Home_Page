/**
 * Logo Cache Utility
 * Client-side caching for team logos to reduce API calls and improve performance
 */

(function() {
    'use strict';

    class LogoCache {
        constructor() {
            this.memoryCache = new Map();
            this.preloadQueue = [];
            this.batchSize = 10;
            this.isPreloading = false;
            this.localStorageKey = 'gbsv_logo_cache_v1';
            this.cacheVersion = '1.0';
            this.maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours
            this.maxCacheSize = 100; // Maximum number of logos to cache

            // Initialize cache from localStorage
            this.loadFromLocalStorage();

            // Bind methods
            this.getTeamLogo = this.getTeamLogo.bind(this);
            this.preloadLogos = this.preloadLogos.bind(this);
        }

        /**
         * Load cached logos from localStorage
         */
        loadFromLocalStorage() {
            try {
                const stored = localStorage.getItem(this.localStorageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.version === this.cacheVersion) {
                        // Load valid cached items into memory
                        const now = Date.now();
                        for (const [key, value] of Object.entries(parsed.logos || {})) {
                            if (now - value.timestamp < this.maxCacheAge) {
                                this.memoryCache.set(key, value.url);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to load logo cache from localStorage:', error);
            }
        }

        /**
         * Save current cache to localStorage
         */
        saveToLocalStorage() {
            try {
                const cacheData = {
                    version: this.cacheVersion,
                    logos: {}
                };

                // Convert Map to object for localStorage
                const entries = Array.from(this.memoryCache.entries());

                // Limit cache size
                if (entries.length > this.maxCacheSize) {
                    entries.splice(this.maxCacheSize);
                }

                for (const [key, url] of entries) {
                    cacheData.logos[key] = {
                        url: url,
                        timestamp: Date.now()
                    };
                }

                localStorage.setItem(this.localStorageKey, JSON.stringify(cacheData));
            } catch (error) {
                console.warn('Failed to save logo cache to localStorage:', error);
            }
        }

        /**
         * Get team logo URL with caching
         * @param {string} teamName - Team name or abbreviation
         * @param {string} league - League (nfl, nba, ncaaf, etc.)
         * @returns {Promise<string>} Logo URL
         */
        async getTeamLogo(teamName, league = 'nfl') {
            if (!teamName) {
                return '';
            }

            const cacheKey = `${league}:${teamName.toLowerCase()}`;

            // Check memory cache first
            if (this.memoryCache.has(cacheKey)) {
                return this.memoryCache.get(cacheKey);
            }

            // Check if API endpoint is available
            const apiAvailable = window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL;

            if (apiAvailable) {
                try {
                    // Fetch from API (which includes Azure cache)
                    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/get-logo?team=${encodeURIComponent(teamName)}&league=${encodeURIComponent(league)}`);

                    if (response.ok) {
                        const data = await response.json();
                        const logoUrl = data.logoUrl;

                        // Cache in memory and localStorage
                        this.memoryCache.set(cacheKey, logoUrl);
                        this.saveToLocalStorage();

                        return logoUrl;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch logo from API for ${teamName}:`, error);
                }
            }

            // Fallback: Generate CDN URL directly (uses LogoLoader to stay on our assets)
            const logoUrl = this.generateLogoUrl(teamName, league);

            // Cache the generated URL
            this.memoryCache.set(cacheKey, logoUrl);
            this.saveToLocalStorage();

            return logoUrl;
        }

        /**
         * Generate logo URL based on team and league
         * @param {string} teamName - Team name or abbreviation
         * @param {string} league - League
         * @returns {string} Generated logo URL
         */
        generateLogoUrl(teamName, league) {
            // Normalize team name
            const teamKey = this.normalizeTeamName(teamName, league);

            // Prefer centralized LogoLoader (Front Door/CDN aware)
            if (window.LogoLoader && typeof window.LogoLoader.getLogoUrl === 'function') {
                return window.LogoLoader.getLogoUrl(league, teamKey);
            }

            // Fallback directly to blob/CDN using the same naming convention
            const base = (window.APP_CONFIG && (window.APP_CONFIG.LOGO_BASE_URL || window.APP_CONFIG.LOGO_FALLBACK_URL)) ||
                         'https://gbsvorchestratorstorage.blob.core.windows.net/team-logos';

            if (league === 'ncaaf' || league === 'college') {
                const ncaaId = this.getNCAATeamId(teamName) || 'default';
                return `${base}/ncaa-500-${ncaaId}.png`;
            }

            return `${base}/${league}-500-${teamKey}.png`;
        }

        /**
         * Normalize team name to logo ID
         */
        normalizeTeamName(teamName, league) {
            const name = teamName.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Team mappings (extend as needed)
            const mappings = {
                'raiders': 'lv',
                'lasvegas': 'lv',
                'lasvegasraiders': 'lv',
                '49ers': 'sf',
                'sanfrancisco': 'sf',
                'rams': 'lar',
                'larams': 'lar',
                'chargers': 'lac',
                'lachargers': 'lac',
                'cardinals': 'ari',
                'arizona': 'ari',
                'packers': 'gb',
                'greenbay': 'gb',
                'patriots': 'ne',
                'newengland': 'ne',
                'saints': 'no',
                'neworleans': 'no',
                'buccaneers': 'tb',
                'tampabay': 'tb',
                'commanders': 'wsh',
                'washington': 'wsh'
            };

            return mappings[name] || teamName.toLowerCase().substring(0, 3);
        }

        /**
         * Get NCAA team ID (limited sample)
         */
        getNCAATeamId(teamName) {
            const ncaaIds = {
                'alabama': '333',
                'georgia': '61',
                'ohiostate': '194',
                'michigan': '130',
                'texas': '251',
                'oklahoma': '201'
            };

            const normalized = teamName.toLowerCase().replace(/[^a-z]/g, '');
            return ncaaIds[normalized] || null;
        }

        /**
         * Preload logos for multiple picks
         * @param {Array} picks - Array of pick objects
         */
        async preloadLogos(picks) {
            if (this.isPreloading || !picks || picks.length === 0) {
                return;
            }

            this.isPreloading = true;
            const teams = new Set();

            // Collect unique team/league combinations
            for (const pick of picks) {
                const league = pick.league || pick.sport || 'nfl';

                if (pick.awayTeam) {
                    teams.add(`${league}:${pick.awayTeam}`);
                }
                if (pick.homeTeam) {
                    teams.add(`${league}:${pick.homeTeam}`);
                }
            }

            // Load in batches
            const teamArray = Array.from(teams);
            for (let i = 0; i < teamArray.length; i += this.batchSize) {
                const batch = teamArray.slice(i, i + this.batchSize);

                await Promise.all(
                    batch.map(key => {
                        const [league, team] = key.split(':');
                        return this.getTeamLogo(team, league).catch(err => {
                            console.warn(`Failed to preload logo for ${team}:`, err);
                            return '';
                        });
                    })
                );

                // Small delay between batches to avoid overwhelming the server
                if (i + this.batchSize < teamArray.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            this.isPreloading = false;
        }

        /**
         * Clear cache
         */
        clearCache() {
            this.memoryCache.clear();
            try {
                localStorage.removeItem(this.localStorageKey);
            } catch (error) {
                console.warn('Failed to clear localStorage cache:', error);
            }
        }

        /**
         * Get cache statistics
         */
        getCacheStats() {
            return {
                memorySize: this.memoryCache.size,
                localStorageKey: this.localStorageKey,
                maxAge: this.maxCacheAge,
                maxSize: this.maxCacheSize,
                isPreloading: this.isPreloading
            };
        }
    }

    // Create singleton instance
    const logoCache = new LogoCache();

    // Export to global scope
    window.LogoCache = logoCache;

    // Also export individual methods for compatibility
    window.getCachedTeamLogo = logoCache.getTeamLogo;
    window.preloadTeamLogos = logoCache.preloadLogos;

    // Override existing getTeamLogo function if it exists
    if (typeof window.getTeamLogo === 'function') {
        const originalGetTeamLogo = window.getTeamLogo;

        window.getTeamLogo = function(teamName, league) {
            // Try cache first, fall back to original
            return logoCache.getTeamLogo(teamName, league).catch(() => {
                return originalGetTeamLogo(teamName, league);
            });
        };
    } else {
        window.getTeamLogo = logoCache.getTeamLogo;
    }

    console.log('Logo cache initialized');
})();

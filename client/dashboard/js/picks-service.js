/**
 * Azure Picks Service - Enterprise-grade pick storage via Azure Cosmos DB
 * Replaces localStorage-based LocalPicksManager
 * 
 * @module PicksService
 */

const PicksService = (function () {
    'use strict';

    // API Configuration
    const API_BASE = window.GBSV_CONFIG?.FUNCTIONS_URL || 'https://gbsv-model-orchestrator.azurewebsites.net';
    const PICKS_ENDPOINT = `${API_BASE}/api/picks`;

    // Cache for performance (optional local caching)
    let picksCache = null;
    let lastFetch = null;
    const CACHE_TTL = 30000; // 30 seconds

    /**
     * Make authenticated API request
     */
    async function apiRequest(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${PICKS_ENDPOINT}${endpoint}`;
        
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `API error: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('[PicksService] API request failed:', error);
            throw error;
        }
    }

    /**
     * Invalidate cache
     */
    function invalidateCache() {
        picksCache = null;
        lastFetch = null;
    }

    /**
     * Get all picks with optional filtering
     * @param {Object} filters - Query filters (status, league, date, etc.)
     * @returns {Promise<Array>} Array of pick objects
     */
    async function getAll(filters = {}) {
        // Build query string
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value);
            }
        });

        const query = params.toString() ? `?${params}` : '';
        
        try {
            const response = await apiRequest(query);
            return response.picks || [];
        } catch (error) {
            console.error('[PicksService] Failed to get picks:', error);
            return [];
        }
    }

    /**
     * Get active picks (pending, live, on-track, at-risk)
     * @returns {Promise<Array>} Array of active picks
     */
    async function getActive() {
        try {
            const response = await apiRequest('/active');
            return response.picks || [];
        } catch (error) {
            console.error('[PicksService] Failed to get active picks:', error);
            return [];
        }
    }

    /**
     * Get settled picks (won, lost, push)
     * @returns {Promise<Array>} Array of settled picks
     */
    async function getSettled() {
        try {
            const response = await apiRequest('/settled');
            return response.picks || [];
        } catch (error) {
            console.error('[PicksService] Failed to get settled picks:', error);
            return [];
        }
    }

    /**
     * Get a single pick by ID
     * @param {string} id - Pick ID
     * @returns {Promise<Object|null>} Pick object or null
     */
    async function getById(id) {
        try {
            const response = await apiRequest(`/${id}`);
            return response.pick || null;
        } catch (error) {
            if (error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Get picks by league
     * @param {string} league - League code (NBA, NFL, NCAAB, NCAAF)
     * @returns {Promise<Array>} Array of picks for the league
     */
    async function getByLeague(league) {
        return getAll({ league: league.toUpperCase() });
    }

    /**
     * Get picks by date
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Array>} Array of picks for the date
     */
    async function getByDate(date) {
        return getAll({ date });
    }

    /**
     * Get picks within a date range
     * @param {string} fromDate - Start date (YYYY-MM-DD)
     * @param {string} toDate - End date (YYYY-MM-DD)
     * @returns {Promise<Array>} Array of picks in range
     */
    async function getByDateRange(fromDate, toDate) {
        return getAll({ from: fromDate, to: toDate });
    }

    /**
     * Get today's picks
     * @returns {Promise<Array>} Array of today's picks
     */
    async function getToday() {
        const today = new Date().toISOString().split('T')[0];
        return getByDate(today);
    }

    /**
     * Create one or more picks
     * @param {Object|Array} picks - Single pick or array of picks
     * @returns {Promise<Object>} Creation result
     */
    async function create(picks) {
        invalidateCache();
        
        const body = Array.isArray(picks) ? picks : [picks];
        
        try {
            const response = await apiRequest('', {
                method: 'POST',
                body
            });

            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('picksUpdated', {
                detail: { action: 'create', count: response.created || body.length }
            }));

            return response;
        } catch (error) {
            console.error('[PicksService] Failed to create picks:', error);
            throw error;
        }
    }

    /**
     * Update a pick
     * @param {string} id - Pick ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated pick
     */
    async function update(id, updates) {
        invalidateCache();
        
        try {
            const response = await apiRequest(`/${id}`, {
                method: 'PATCH',
                body: updates
            });

            window.dispatchEvent(new CustomEvent('picksUpdated', {
                detail: { action: 'update', id }
            }));

            return response.pick;
        } catch (error) {
            console.error('[PicksService] Failed to update pick:', error);
            throw error;
        }
    }

    /**
     * Update pick status (convenience method)
     * @param {string} id - Pick ID
     * @param {string} status - New status (pending, live, won, lost, push)
     * @param {Object} additionalUpdates - Optional additional fields
     * @returns {Promise<Object>} Updated pick
     */
    async function updateStatus(id, status, additionalUpdates = {}) {
        return update(id, { status, ...additionalUpdates });
    }

    /**
     * Mark pick as won
     * @param {string} id - Pick ID
     * @param {number} pnl - P&L amount
     * @returns {Promise<Object>} Updated pick
     */
    async function markWon(id, pnl = 0) {
        return update(id, { status: 'won', result: 'WIN', pnl });
    }

    /**
     * Mark pick as lost
     * @param {string} id - Pick ID
     * @param {number} pnl - P&L amount (negative)
     * @returns {Promise<Object>} Updated pick
     */
    async function markLost(id, pnl = 0) {
        return update(id, { status: 'lost', result: 'LOSS', pnl: -Math.abs(pnl) });
    }

    /**
     * Mark pick as push
     * @param {string} id - Pick ID
     * @returns {Promise<Object>} Updated pick
     */
    async function markPush(id) {
        return update(id, { status: 'push', result: 'PUSH', pnl: 0 });
    }

    /**
     * Delete a pick
     * @param {string} id - Pick ID
     * @returns {Promise<boolean>} Success status
     */
    async function remove(id) {
        invalidateCache();
        
        try {
            await apiRequest(`/${id}`, { method: 'DELETE' });

            window.dispatchEvent(new CustomEvent('picksUpdated', {
                detail: { action: 'delete', id }
            }));

            return true;
        } catch (error) {
            console.error('[PicksService] Failed to delete pick:', error);
            throw error;
        }
    }

    /**
     * Clear all picks (requires confirmation)
     * @param {boolean} confirm - Must be true to proceed
     * @returns {Promise<Object>} Deletion result
     */
    async function clearAll(confirm = false) {
        if (!confirm) {
            throw new Error('Must pass confirm=true to clear all picks');
        }

        invalidateCache();

        try {
            const response = await apiRequest('/clear', {
                method: 'DELETE',
                headers: {
                    'x-confirm-clear': 'true'
                }
            });

            window.dispatchEvent(new CustomEvent('picksUpdated', {
                detail: { action: 'clearAll', deleted: response.deleted }
            }));

            return response;
        } catch (error) {
            console.error('[PicksService] Failed to clear picks:', error);
            throw error;
        }
    }

    /**
     * Calculate summary statistics for picks
     * @param {Array} picks - Array of picks to analyze (optional, fetches if not provided)
     * @returns {Promise<Object>} Summary stats
     */
    async function getSummary(picks = null) {
        if (!picks) {
            picks = await getAll();
        }

        const summary = {
            total: picks.length,
            pending: 0,
            live: 0,
            won: 0,
            lost: 0,
            push: 0,
            totalRisk: 0,
            totalPnl: 0,
            byLeague: {}
        };

        picks.forEach(pick => {
            const status = (pick.status || 'pending').toLowerCase();
            if (status === 'pending') summary.pending++;
            else if (status === 'live' || status === 'on-track' || status === 'at-risk') summary.live++;
            else if (status === 'won' || status === 'win') summary.won++;
            else if (status === 'lost' || status === 'loss') summary.lost++;
            else if (status === 'push') summary.push++;

            summary.totalRisk += parseFloat(pick.risk) || 0;
            summary.totalPnl += parseFloat(pick.pnl) || 0;

            const league = pick.league || 'Unknown';
            if (!summary.byLeague[league]) {
                summary.byLeague[league] = { total: 0, won: 0, lost: 0, pnl: 0 };
            }
            summary.byLeague[league].total++;
            if (status === 'won' || status === 'win') summary.byLeague[league].won++;
            if (status === 'lost' || status === 'loss') summary.byLeague[league].lost++;
            summary.byLeague[league].pnl += parseFloat(pick.pnl) || 0;
        });

        summary.winRate = summary.won + summary.lost > 0
            ? (summary.won / (summary.won + summary.lost) * 100).toFixed(1) + '%'
            : 'N/A';

        return summary;
    }

    /**
     * Migrate picks from localStorage to Azure (one-time operation)
     * @returns {Promise<Object>} Migration result
     */
    async function migrateFromLocalStorage() {
        const STORAGE_KEY = 'gbsv_picks';
        
        try {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (!localData) {
                return { success: true, migrated: 0, message: 'No local picks to migrate' };
            }

            const localPicks = JSON.parse(localData);
            if (!Array.isArray(localPicks) || localPicks.length === 0) {
                return { success: true, migrated: 0, message: 'No local picks to migrate' };
            }

            console.log(`[PicksService] Migrating ${localPicks.length} picks from localStorage to Azure...`);
            
            const result = await create(localPicks);
            
            if (result.success) {
                // Backup and clear localStorage
                localStorage.setItem(`${STORAGE_KEY}_backup_${Date.now()}`, localData);
                localStorage.removeItem(STORAGE_KEY);
                
                console.log(`[PicksService] Migration complete: ${result.created} picks migrated`);
                return {
                    success: true,
                    migrated: result.created,
                    errors: result.errors,
                    message: `Successfully migrated ${result.created} picks to Azure`
                };
            }

            return { success: false, migrated: 0, error: 'Migration failed' };
        } catch (error) {
            console.error('[PicksService] Migration failed:', error);
            return { success: false, migrated: 0, error: error.message };
        }
    }

    /**
     * Check if there are picks in localStorage that need migration
     * @returns {Object} Migration status
     */
    function checkMigrationNeeded() {
        const STORAGE_KEY = 'gbsv_picks';
        try {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (!localData) return { needed: false, count: 0 };
            
            const localPicks = JSON.parse(localData);
            return {
                needed: Array.isArray(localPicks) && localPicks.length > 0,
                count: Array.isArray(localPicks) ? localPicks.length : 0
            };
        } catch {
            return { needed: false, count: 0 };
        }
    }

    // Public API
    return {
        // Core CRUD
        getAll,
        getActive,
        getSettled,
        getById,
        create,
        update,
        remove,
        clearAll,

        // Convenience getters
        getByLeague,
        getByDate,
        getByDateRange,
        getToday,

        // Status updates
        updateStatus,
        markWon,
        markLost,
        markPush,

        // Analytics
        getSummary,

        // Migration
        migrateFromLocalStorage,
        checkMigrationNeeded,

        // Utilities
        invalidateCache
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PicksService;
}

// Make globally available
window.PicksService = PicksService;

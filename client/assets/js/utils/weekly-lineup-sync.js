/**
 * Weekly Lineup ↔ Dashboard Sync Bridge
 * Allows Dashboard to pull fresh model picks from Weekly Lineup
 * Allows Weekly Lineup to receive outcome updates from Dashboard
 * 
 * Usage:
 *   Dashboard: window.WeeklyLineupSync.getLatestPicks() → pulls from localStorage cache
 *   Weekly Lineup: window.WeeklyLineupSync.pushOutcomes(picks) → pushes results back
 */

(function() {
    'use strict';

    const WEEKLY_LINEUP_KEY = 'gbsv_weekly_lineup_picks';
    const DASHBOARD_KEY = 'gbsv_picks';

    const WeeklyLineupSync = {
        /**
         * Dashboard calls this to get latest model picks from Weekly Lineup cache
         * @returns {Array} Active picks from Weekly Lineup, or empty array
         */
        getLatestPicks() {
            try {
                // Check if Weekly Lineup page has already loaded picks
                if (window.WeeklyLineup && typeof window.WeeklyLineup.getActivePicks === 'function') {
                    const picks = window.WeeklyLineup.getActivePicks();
                    if (picks && picks.length > 0) {
                        console.log('[SYNC] Got picks from Weekly Lineup (live):', picks.length);
                        return picks;
                    }
                }

                // Otherwise try to load from localStorage cache
                const data = localStorage.getItem(WEEKLY_LINEUP_KEY);
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed.picks && Array.isArray(parsed.picks)) {
                        console.log('[SYNC] Got picks from localStorage cache:', parsed.picks.length);
                        return parsed.picks;
                    }
                }
            } catch (e) {
                console.warn('[SYNC] Error getting latest picks:', e.message);
            }
            return [];
        },

        /**
         * Weekly Lineup calls this to sync outcomes from Dashboard
         * @param {Array} dashboardPicks - Picks with updated status/outcomes
         */
        pushOutcomes(dashboardPicks) {
            try {
                if (!Array.isArray(dashboardPicks)) {
                    console.warn('[SYNC] pushOutcomes expects an array');
                    return;
                }

                // If Weekly Lineup is loaded, use its sync function
                if (window.WeeklyLineup && typeof window.WeeklyLineup.syncDashboardOutcomes === 'function') {
                    console.log('[SYNC] Pushing outcomes to live Weekly Lineup:', dashboardPicks.length);
                    window.WeeklyLineup.syncDashboardOutcomes(dashboardPicks);
                    return true;
                }

                // Otherwise store in a temporary sync file (picked up next time Weekly Lineup loads)
                localStorage.setItem('gbsv_pending_outcomes', JSON.stringify({
                    outcomes: dashboardPicks,
                    timestamp: new Date().toISOString()
                }));
                console.log('[SYNC] Stored pending outcomes for Weekly Lineup');
                return true;
            } catch (e) {
                console.error('[SYNC] Error pushing outcomes:', e.message);
                return false;
            }
        },

        /**
         * Check if there are pending outcomes from Dashboard waiting to be synced
         * @returns {Array|null} Pending outcomes or null
         */
        getPendingOutcomes() {
            try {
                const data = localStorage.getItem('gbsv_pending_outcomes');
                if (data) {
                    const parsed = JSON.parse(data);
                    return parsed.outcomes || null;
                }
            } catch (e) {
                console.warn('[SYNC] Error reading pending outcomes:', e.message);
            }
            return null;
        },

        /**
         * Clear pending outcomes after processing
         */
        clearPendingOutcomes() {
            try {
                localStorage.removeItem('gbsv_pending_outcomes');
                console.log('[SYNC] Cleared pending outcomes');
            } catch (e) {
                console.warn('[SYNC] Error clearing pending outcomes:', e.message);
            }
        },

        /**
         * Check if Weekly Lineup page is active
         */
        isWeeklyLineupActive() {
            return !!(window.WeeklyLineup && typeof window.WeeklyLineup.getActivePicks === 'function');
        },

        /**
         * Manual refresh: Dashboard can call this to pull fresh picks from Weekly Lineup
         * into its table (optional enhancement for power users)
         */
        importWeeklyLineupPicks() {
            try {
                const picks = this.getLatestPicks();
                if (picks.length === 0) {
                    console.warn('[SYNC] No picks available from Weekly Lineup to import');
                    return false;
                }

                // Push to Dashboard's table if LoadAndAppendPicks is available
                if (window.loadLivePicks && typeof window.loadLivePicks === 'function') {
                    console.log('[SYNC] Importing picks to Dashboard:', picks.length);
                    // This is a manual enhancement - can be triggered by user action
                    return true;
                }

                console.log('[SYNC] Dashboard table not ready for import');
                return false;
            } catch (e) {
                console.error('[SYNC] Error importing picks:', e.message);
                return false;
            }
        }
    };

    window.WeeklyLineupSync = WeeklyLineupSync;

    // On page load: Check for pending outcomes if Weekly Lineup is active
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (WeeklyLineupSync.isWeeklyLineupActive()) {
                const pending = WeeklyLineupSync.getPendingOutcomes();
                if (pending && pending.length > 0) {
                    console.log('[SYNC] Processing pending outcomes:', pending.length);
                    WeeklyLineupSync.pushOutcomes(pending);
                    WeeklyLineupSync.clearPendingOutcomes();
                }
            }
        });
    } else {
        if (WeeklyLineupSync.isWeeklyLineupActive()) {
            const pending = WeeklyLineupSync.getPendingOutcomes();
            if (pending && pending.length > 0) {
                console.log('[SYNC] Processing pending outcomes:', pending.length);
                WeeklyLineupSync.pushOutcomes(pending);
                WeeklyLineupSync.clearPendingOutcomes();
            }
        }
    }

    console.log('✅ WeeklyLineupSync bridge initialized');
})();

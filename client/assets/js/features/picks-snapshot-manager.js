/**
 * Picks Snapshot Manager v1.0
 * Manages timestamped snapshots of picks for historical viewing
 */

(function() {
    'use strict';

    const SNAPSHOTS_STORAGE_KEY = 'gbsv_picks_snapshots';
    const MAX_SNAPSHOTS = 50; // Keep last 50 snapshots

    /**
     * Save a snapshot of current picks
     * @param {Array} picks - Array of pick objects
     * @param {string} source - Source of the picks (e.g., 'manual', 'auto-refresh', 'initial-load')
     * @returns {string} - Snapshot ID
     */
    function saveSnapshot(picks, source = 'manual') {
        try {
            const snapshots = getSnapshots();
            const timestamp = new Date();
            const snapshotId = `${timestamp.getTime()}_${source}`;
            
            const snapshot = {
                id: snapshotId,
                timestamp: timestamp.toISOString(),
                timestampDisplay: formatTimestamp(timestamp),
                source: source,
                pickCount: picks.length,
                picks: JSON.parse(JSON.stringify(picks)), // Deep clone
                leagues: [...new Set(picks.map(p => p.league || 'unknown'))],
                summary: generateSnapshotSummary(picks)
            };

            snapshots.unshift(snapshot); // Add to beginning
            
            // Trim to max snapshots
            if (snapshots.length > MAX_SNAPSHOTS) {
                snapshots.length = MAX_SNAPSHOTS;
            }

            localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
            
            console.log(`✅ Snapshot saved: ${snapshotId} (${picks.length} picks)`);
            return snapshotId;
        } catch (error) {
            console.error('Failed to save snapshot:', error);
            return null;
        }
    }

    /**
     * Get all snapshots
     * @returns {Array} - Array of snapshot objects
     */
    function getSnapshots() {
        try {
            const stored = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load snapshots:', error);
            return [];
        }
    }

    /**
     * Get a specific snapshot by ID
     * @param {string} snapshotId - Snapshot ID
     * @returns {Object|null} - Snapshot object or null
     */
    function getSnapshot(snapshotId) {
        const snapshots = getSnapshots();
        return snapshots.find(s => s.id === snapshotId) || null;
    }

    /**
     * Delete a snapshot
     * @param {string} snapshotId - Snapshot ID
     * @returns {boolean} - Success status
     */
    function deleteSnapshot(snapshotId) {
        try {
            const snapshots = getSnapshots();
            const filtered = snapshots.filter(s => s.id !== snapshotId);
            localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Failed to delete snapshot:', error);
            return false;
        }
    }

    /**
     * Clear all snapshots
     */
    function clearAllSnapshots() {
        try {
            localStorage.removeItem(SNAPSHOTS_STORAGE_KEY);
            console.log('✅ All snapshots cleared');
        } catch (error) {
            console.error('Failed to clear snapshots:', error);
        }
    }

    /**
     * Get snapshots grouped by date
     * @returns {Object} - Snapshots grouped by date
     */
    function getSnapshotsByDate() {
        const snapshots = getSnapshots();
        const grouped = {};

        snapshots.forEach(snapshot => {
            const date = snapshot.timestamp.split('T')[0]; // YYYY-MM-DD
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(snapshot);
        });

        return grouped;
    }

    /**
     * Format timestamp for display
     * @param {Date} date - Date object
     * @returns {string} - Formatted timestamp
     */
    function formatTimestamp(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        // If today
        if (diffDays === 0) {
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        }

        // If yesterday
        if (diffDays === 1) {
            return `Yesterday ${formatTime(date)}`;
        }

        // If this week
        if (diffDays < 7) {
            return `${diffDays} days ago ${formatTime(date)}`;
        }

        // Otherwise full date
        return formatDate(date);
    }

    /**
     * Format time
     * @param {Date} date - Date object
     * @returns {string} - Formatted time
     */
    function formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }

    /**
     * Format date
     * @param {Date} date - Date object
     * @returns {string} - Formatted date
     */
    function formatDate(date) {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    /**
     * Generate snapshot summary
     * @param {Array} picks - Array of pick objects
     * @returns {Object} - Summary object
     */
    function generateSnapshotSummary(picks) {
        const summary = {
            total: picks.length,
            byLeague: {},
            byPickType: {},
            avgEdge: 0,
            maxFire: 0
        };

        let totalEdge = 0;
        let edgeCount = 0;

        picks.forEach(pick => {
            // By league
            const league = pick.league || 'unknown';
            summary.byLeague[league] = (summary.byLeague[league] || 0) + 1;

            // By pick type
            const pickType = pick.pick_type || pick.pickType || 'unknown';
            summary.byPickType[pickType] = (summary.byPickType[pickType] || 0) + 1;

            // Edge calculation
            const edge = parseFloat(pick.edge || pick.edgeValue || 0);
            if (!isNaN(edge) && edge > 0) {
                totalEdge += edge;
                edgeCount++;
            }

            // Max fire
            const fire = parseInt(pick.fire || pick.fireRating || 0, 10);
            if (!isNaN(fire) && fire > summary.maxFire) {
                summary.maxFire = fire;
            }
        });

        summary.avgEdge = edgeCount > 0 ? (totalEdge / edgeCount).toFixed(2) : 0;

        return summary;
    }

    // Export to window
    window.PicksSnapshotManager = {
        saveSnapshot,
        getSnapshots,
        getSnapshot,
        deleteSnapshot,
        clearAllSnapshots,
        getSnapshotsByDate,
        formatTimestamp,
        formatDate,
        formatTime
    };

    console.log('✅ PicksSnapshotManager loaded');

})();

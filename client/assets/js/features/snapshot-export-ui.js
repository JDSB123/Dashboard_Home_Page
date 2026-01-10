/**
 * Snapshot & Export UI Controller v1.0
 * Handles UI interactions for snapshot history and export features
 */

(function() {
    'use strict';

    let currentSnapshotId = null;
    let currentPicks = [];

    /**
     * Initialize the UI controller
     */
    function init() {
        // Wait for managers to be loaded
        if (!window.PicksSnapshotManager || !window.PicksExportManager) {
            console.warn('Snapshot/Export managers not loaded yet, retrying...');
            setTimeout(init, 100);
            return;
        }

        setupEventListeners();
        updateSnapshotUI();
        console.log('✅ Snapshot & Export UI Controller initialized');
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Snapshot dropdown toggle
        const snapshotBtn = document.getElementById('snapshot-dropdown-btn');
        const snapshotMenu = document.getElementById('snapshot-dropdown-menu');
        
        if (snapshotBtn && snapshotMenu) {
            snapshotBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = snapshotMenu.style.display === 'block';
                closeAllDropdowns();
                if (!isOpen) {
                    snapshotMenu.style.display = 'block';
                    updateSnapshotUI();
                }
            });
        }

        // Export dropdown toggle
        const exportBtn = document.getElementById('export-dropdown-btn');
        const exportMenu = document.getElementById('export-dropdown-menu');
        
        if (exportBtn && exportMenu) {
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = exportMenu.style.display === 'block';
                closeAllDropdowns();
                if (!isOpen) {
                    exportMenu.style.display = 'block';
                }
            });
        }

        // Export buttons
        document.getElementById('export-html')?.addEventListener('click', () => {
            exportCurrentPicks('html');
            closeAllDropdowns();
        });

        document.getElementById('export-csv')?.addEventListener('click', () => {
            exportCurrentPicks('csv');
            closeAllDropdowns();
        });

        document.getElementById('export-pdf')?.addEventListener('click', () => {
            exportCurrentPicks('pdf');
            closeAllDropdowns();
        });

        // Clear all snapshots
        document.getElementById('clear-snapshots-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to clear all saved snapshots?')) {
                window.PicksSnapshotManager.clearAllSnapshots();
                currentSnapshotId = null;
                updateSnapshotUI();
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ft-dropdown')) {
                closeAllDropdowns();
            }
        });

        // Listen for picks updates
        document.addEventListener('picks-updated', (e) => {
            currentPicks = e.detail?.picks || [];
        });

        // Listen for snapshot changes
        document.addEventListener('snapshot-loaded', (e) => {
            currentSnapshotId = e.detail?.snapshotId || null;
            updateSnapshotUI();
        });
    }

    /**
     * Close all dropdowns
     */
    function closeAllDropdowns() {
        document.querySelectorAll('.ft-dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }

    /**
     * Update snapshot UI
     */
    function updateSnapshotUI() {
        const snapshotList = document.getElementById('snapshot-list');
        if (!snapshotList) return;

        const snapshots = window.PicksSnapshotManager.getSnapshots();
        
        if (snapshots.length === 0) {
            snapshotList.innerHTML = '<div class="snapshot-empty">No snapshots saved yet</div>';
            return;
        }

        const snapshotsByDate = window.PicksSnapshotManager.getSnapshotsByDate();
        const dates = Object.keys(snapshotsByDate).sort().reverse();

        let html = '';
        
        dates.forEach(date => {
            const dateSnaps = snapshotsByDate[date];
            const dateObj = new Date(date);
            const dateLabel = formatDateLabel(dateObj);
            
            html += `<div class="snapshot-date-group">
                <div class="snapshot-date-label">${dateLabel}</div>`;
            
            dateSnaps.forEach(snapshot => {
                const isCurrent = snapshot.id === currentSnapshotId;
                const leagues = snapshot.leagues?.join(', ') || 'N/A';
                
                html += `
                <div class="snapshot-item ${isCurrent ? 'current' : ''}" data-snapshot-id="${snapshot.id}">
                    <div class="snapshot-info">
                        <div class="snapshot-time">${snapshot.timestampDisplay}</div>
                        <div class="snapshot-meta">
                            <span class="snapshot-meta-item">📊 ${snapshot.pickCount} picks</span>
                            <span class="snapshot-meta-item">🏀 ${leagues}</span>
                            ${snapshot.summary?.avgEdge ? `<span class="snapshot-meta-item">📈 ${snapshot.summary.avgEdge}% avg</span>` : ''}
                        </div>
                    </div>
                    <div class="snapshot-actions">
                        <button class="snapshot-delete-btn" data-snapshot-id="${snapshot.id}" title="Delete snapshot">🗑️</button>
                    </div>
                </div>`;
            });
            
            html += '</div>';
        });

        snapshotList.innerHTML = html;

        // Add event listeners to snapshot items
        snapshotList.querySelectorAll('.snapshot-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.snapshot-delete-btn')) {
                    const snapshotId = item.dataset.snapshotId;
                    loadSnapshot(snapshotId);
                    closeAllDropdowns();
                }
            });
        });

        // Add event listeners to delete buttons
        snapshotList.querySelectorAll('.snapshot-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const snapshotId = btn.dataset.snapshotId;
                deleteSnapshot(snapshotId);
            });
        });
    }

    /**
     * Format date label
     * @param {Date} date - Date object
     * @returns {string} - Formatted label
     */
    function formatDateLabel(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        const diffDays = Math.floor((today - targetDate) / 86400000);
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    /**
     * Load a snapshot
     * @param {string} snapshotId - Snapshot ID
     */
    function loadSnapshot(snapshotId) {
        const snapshot = window.PicksSnapshotManager.getSnapshot(snapshotId);
        if (!snapshot) {
            alert('Snapshot not found');
            return;
        }

        currentSnapshotId = snapshotId;
        currentPicks = snapshot.picks;

        // Dispatch event for other components to handle
        document.dispatchEvent(new CustomEvent('load-snapshot', {
            detail: { snapshot, picks: snapshot.picks }
        }));

        console.log(`✅ Loaded snapshot: ${snapshotId}`);
    }

    /**
     * Delete a snapshot
     * @param {string} snapshotId - Snapshot ID
     */
    function deleteSnapshot(snapshotId) {
        if (confirm('Delete this snapshot?')) {
            window.PicksSnapshotManager.deleteSnapshot(snapshotId);
            if (currentSnapshotId === snapshotId) {
                currentSnapshotId = null;
            }
            updateSnapshotUI();
        }
    }

    /**
     * Export current picks
     * @param {string} format - Export format ('html', 'csv', 'pdf')
     */
    function exportCurrentPicks(format) {
        // Get picks from the current view
        const picks = getCurrentVisiblePicks();
        
        if (!picks || picks.length === 0) {
            alert('No picks to export');
            return;
        }

        const timestamp = new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        const options = {
            title: `Weekly Lineup - ${timestamp}`
        };

        switch (format) {
            case 'html':
                window.PicksExportManager.exportToHTML(picks, options);
                console.log(`✅ Exported ${picks.length} picks to HTML`);
                break;
            case 'csv':
                window.PicksExportManager.exportToCSV(picks, options);
                console.log(`✅ Exported ${picks.length} picks to CSV`);
                break;
            case 'pdf':
                window.PicksExportManager.exportToPDF(picks, options);
                console.log(`✅ Exported ${picks.length} picks to PDF`);
                break;
        }
    }

    /**
     * Get current visible picks from the table
     * @returns {Array} - Array of pick objects
     */
    function getCurrentVisiblePicks() {
        // Try to get from current picks state
        if (currentPicks && currentPicks.length > 0) {
            return currentPicks;
        }

        // Try to get from localStorage
        const storedPicks = localStorage.getItem('gbsv_weekly_lineup_picks');
        if (storedPicks) {
            try {
                return JSON.parse(storedPicks);
            } catch (e) {
                console.error('Failed to parse stored picks:', e);
            }
        }

        // Fallback: scrape from table (less reliable but better than nothing)
        return scrapePicksFromTable();
    }

    /**
     * Scrape picks from the table as a fallback
     * @returns {Array} - Array of pick objects
     */
    function scrapePicksFromTable() {
        const picks = [];
        const rows = document.querySelectorAll('.weekly-lineup-table tbody tr');
        
        rows.forEach(row => {
            if (row.style.display === 'none') return; // Skip hidden rows
            
            const cells = row.querySelectorAll('td');
            if (cells.length < 7) return;
            
            picks.push({
                datetime: cells[0]?.textContent?.trim() || '',
                league: cells[1]?.textContent?.trim() || '',
                matchup: cells[2]?.textContent?.trim() || '',
                away_team: cells[2]?.textContent?.split('@')[0]?.trim() || '',
                home_team: cells[2]?.textContent?.split('@')[1]?.trim() || '',
                segment: cells[3]?.textContent?.trim() || '',
                pick: cells[4]?.textContent?.trim() || '',
                edge: cells[5]?.textContent?.replace('%', '').trim() || '',
                fire: cells[6]?.textContent?.trim()?.length || 0
            });
        });
        
        return picks;
    }

    /**
     * Save current picks as a snapshot
     * @param {string} source - Source of the snapshot
     */
    function saveCurrentSnapshot(source = 'manual') {
        const picks = getCurrentVisiblePicks();
        if (picks && picks.length > 0) {
            const snapshotId = window.PicksSnapshotManager.saveSnapshot(picks, source);
            currentSnapshotId = snapshotId;
            updateSnapshotUI();
            return snapshotId;
        }
        return null;
    }

    // Export functions
    window.SnapshotExportUI = {
        init,
        saveCurrentSnapshot,
        loadSnapshot,
        updateSnapshotUI,
        exportCurrentPicks
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

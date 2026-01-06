/**
 * Filter State Persistence
 * Persists filter state to localStorage and restores on page load
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'gbsv_filter_state';
    const STORAGE_VERSION = '1.0';

    /**
     * Save filter state to localStorage
     */
    function saveFilterState() {
        try {
            if (!window.tableState || !window.tableState.filters) {
                return;
            }

            const stateToSave = {
                version: STORAGE_VERSION,
                filters: {
                    matchup: {
                        league: window.tableState.filters.matchup?.league || '',
                        selectedLeagues: window.tableState.filters.matchup?.selectedLeagues || null
                    },
                    pick: {
                        segment: window.tableState.filters.pick?.segment || '',
                        selectedSegments: window.tableState.filters.pick?.selectedSegments || null
                    },
                    status: window.tableState.filters.status || []
                },
                // Also save DashboardFilterPills state if available
                dashboardFilters: window.DashboardFilterPills ? {
                    leagues: window.DashboardFilterPills.activeFilters?.leagues || [],
                    segment: window.DashboardFilterPills.activeFilters?.segment || '',
                    pick: window.DashboardFilterPills.activeFilters?.pick || '',
                    status: window.DashboardFilterPills.activeFilters?.status || ''
                } : null,
                timestamp: Date.now()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.warn('[FilterStatePersistence] Failed to save filter state:', e);
        }
    }

    /**
     * Load filter state from localStorage
     */
    function loadFilterState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) {
                return null;
            }

            const state = JSON.parse(saved);
            
            // Validate version
            if (state.version !== STORAGE_VERSION) {
                console.log('[FilterStatePersistence] Version mismatch, clearing old state');
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return state;
        } catch (e) {
            console.warn('[FilterStatePersistence] Failed to load filter state:', e);
            return null;
        }
    }

    /**
     * Restore filter state to UI
     */
    function restoreFilterState() {
        const saved = loadFilterState();
        if (!saved) {
            return;
        }

        // Restore tableState filters
        if (saved.filters && window.tableState && window.tableState.filters) {
            if (saved.filters.matchup) {
                window.tableState.filters.matchup.league = saved.filters.matchup.league || '';
                window.tableState.filters.matchup.selectedLeagues = saved.filters.matchup.selectedLeagues;
            }
            if (saved.filters.pick) {
                window.tableState.filters.pick.segment = saved.filters.pick.segment || '';
                window.tableState.filters.pick.selectedSegments = saved.filters.pick.selectedSegments;
            }
            if (saved.filters.status) {
                window.tableState.filters.status = saved.filters.status;
            }
        }

        // Restore DashboardFilterPills state
        if (saved.dashboardFilters && window.DashboardFilterPills) {
            window.DashboardFilterPills.activeFilters = {
                leagues: saved.dashboardFilters.leagues || [],
                segment: saved.dashboardFilters.segment || '',
                pick: saved.dashboardFilters.pick || '',
                status: saved.dashboardFilters.status || ''
            };

            // Restore UI state
            setTimeout(() => {
                // Restore league pills
                if (saved.dashboardFilters.leagues && saved.dashboardFilters.leagues.length > 0) {
                    document.querySelectorAll('.ft-pill.ft-league').forEach(pill => {
                        const value = pill.getAttribute('data-league');
                        if (value === 'all') {
                            pill.classList.remove('active');
                        } else if (saved.dashboardFilters.leagues.includes(value)) {
                            pill.classList.add('active');
                        }
                    });
                }

                // Restore segment dropdown
                if (saved.dashboardFilters.segment) {
                    const segmentBtn = document.getElementById('segment-dropdown-btn');
                    const segmentItem = document.querySelector(`#segment-dropdown-menu .ft-dropdown-item[data-v="${saved.dashboardFilters.segment}"]`);
                    if (segmentItem && segmentBtn) {
                        document.querySelectorAll('#segment-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                        segmentItem.classList.add('active');
                        const labels = {
                            'all': 'Segment',
                            'full': 'Full Game',
                            '1h': '1st Half',
                            '2h': '2nd Half'
                        };
                        segmentBtn.textContent = `${labels[saved.dashboardFilters.segment] || 'Segment'} ▾`;
                    }
                }

                // Restore pick type dropdown
                if (saved.dashboardFilters.pick) {
                    const pickBtn = document.getElementById('pick-dropdown-btn');
                    const pickItem = document.querySelector(`#pick-dropdown-menu .ft-dropdown-item[data-v="${saved.dashboardFilters.pick}"]`);
                    if (pickItem && pickBtn) {
                        document.querySelectorAll('#pick-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                        pickItem.classList.add('active');
                        const labels = {
                            'all': 'Pick Type',
                            'spread': 'Spread',
                            'ml': 'Moneyline',
                            'total': 'Total',
                            'tt': 'Team Total'
                        };
                        pickBtn.textContent = `${labels[saved.dashboardFilters.pick] || 'Pick Type'} ▾`;
                    }
                }

                // Restore status dropdown
                if (saved.dashboardFilters.status) {
                    const statusBtn = document.getElementById('status-dropdown-btn');
                    const statusItem = document.querySelector(`#status-dropdown-menu .ft-dropdown-item[data-v="${saved.dashboardFilters.status}"]`);
                    if (statusItem && statusBtn) {
                        document.querySelectorAll('#status-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                        statusItem.classList.add('active');
                        const labels = {
                            'all': 'Status',
                            'pending': 'Pending',
                            'win': 'Won',
                            'loss': 'Lost',
                            'push': 'Push'
                        };
                        statusBtn.textContent = `${labels[saved.dashboardFilters.status] || 'Status'} ▾`;
                    }
                }

                // Apply filters
                if (window.DashboardFilterPills && typeof window.DashboardFilterPills.applyFilters === 'function') {
                    window.DashboardFilterPills.applyFilters();
                }
            }, 100);
        }
    }

    /**
     * Clear saved filter state
     */
    function clearFilterState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('[FilterStatePersistence] Failed to clear filter state:', e);
        }
    }

    // Auto-save on filter changes (debounced)
    let saveTimeout = null;
    function scheduleSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveFilterState, 500);
    }

    // Hook into filter changes
    function initializePersistence() {
        // Watch for DashboardFilterPills changes
        if (window.DashboardFilterPills) {
            const originalApplyFilters = window.DashboardFilterPills.applyFilters;
            if (originalApplyFilters) {
                window.DashboardFilterPills.applyFilters = function() {
                    originalApplyFilters.apply(this, arguments);
                    scheduleSave();
                };
            }
        }

        // Watch for tableState changes
        const originalUpdateFilter = window.PicksStateManager?.updateFilter;
        if (originalUpdateFilter) {
            window.PicksStateManager.updateFilter = function(filterType, updates) {
                originalUpdateFilter.apply(this, arguments);
                scheduleSave();
            };
        }

        // Restore state on page load
        restoreFilterState();
    }

    // Export to global scope
    window.FilterStatePersistence = {
        save: saveFilterState,
        load: loadFilterState,
        restore: restoreFilterState,
        clear: clearFilterState,
        init: initializePersistence
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePersistence);
    } else {
        initializePersistence();
    }

})();

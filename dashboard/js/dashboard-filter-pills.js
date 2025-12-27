/**
 * Dashboard Filter Pills Handler
 * Handles filter pill clicks and updates filter chips display
 * Similar to weekly-lineup filter logic
 */

(function() {
    'use strict';

    let activeFilters = {
        leagues: [], // Multi-select for leagues
        segment: '',
        pick: '',
        status: ''
    };

    /**
     * Initialize filter pill handlers
     */
    function initializeFilterPills() {
        console.log('[DashboardFilterPills] Initializing filter pills...');

        const toolbar = document.getElementById('filter-toolbar');
        if (!toolbar) {
            console.warn('[DashboardFilterPills] Filter toolbar not found');
            return;
        }

        // League filter pills (multi-select) - ensure they don't trigger dropdowns
        document.querySelectorAll('.ft-pill.ft-league').forEach(pill => {
            pill.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                const leagueValue = this.getAttribute('data-league');
                console.log('[DashboardFilterPills] League pill clicked:', leagueValue);

                // Ensure no dropdowns are open
                toolbar.querySelectorAll('.ft-dropdown-menu').forEach(m => m.classList.remove('open'));
                toolbar.querySelectorAll('.ft-dropdown-btn').forEach(b => b.classList.remove('open'));

                // Toggle active state
                this.classList.toggle('active');

                // Update active leagues array
                activeFilters.leagues = [];
                document.querySelectorAll('.ft-pill.ft-league.active').forEach(pill => {
                    const value = pill.getAttribute('data-league');
                    if (value && value !== 'all') {
                        activeFilters.leagues.push(value.toLowerCase());
                    }
                });

                // If "All" is clicked and active, clear other selections
                if (leagueValue === 'all' && this.classList.contains('active')) {
                    document.querySelectorAll('.ft-pill.ft-league').forEach(p => {
                        if (p !== this) p.classList.remove('active');
                    });
                    activeFilters.leagues = [];
                } else if (leagueValue !== 'all') {
                    // If a specific league is clicked, remove "All"
                    document.querySelector('.ft-pill.ft-league[data-league="all"]')?.classList.remove('active');
                }

                applyFilters();
            });
        });

        // Dropdown toggle logic - ONLY for dropdown buttons, not pills
        const dropdowns = toolbar.querySelectorAll('.ft-dropdown');
        dropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.ft-dropdown-btn');
            const menu = dropdown.querySelector('.ft-dropdown-menu');
            if (!btn || !menu) return;
            
            // Only attach to dropdown buttons, explicitly exclude pills
            btn.addEventListener('click', (e) => {
                // Prevent if clicking on a pill
                if (e.target.closest('.ft-pill')) {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // Close all other dropdowns
                dropdowns.forEach(d => {
                    if (d !== dropdown) {
                        d.querySelector('.ft-dropdown-menu')?.classList.remove('open');
                        d.querySelector('.ft-dropdown-btn')?.classList.remove('open');
                    }
                });
                // Toggle this dropdown
                menu.classList.toggle('open');
                btn.classList.toggle('open');
            });
        });

        // Close dropdowns when clicking outside - but not on league pills
        document.addEventListener('click', (e) => {
            // Don't close if clicking on a league pill
            if (e.target.closest('.ft-pill.ft-league')) {
                return;
            }
            
            // Close dropdowns if clicking outside dropdown containers
            if (!e.target.closest('.ft-dropdown')) {
                toolbar.querySelectorAll('.ft-dropdown-menu').forEach(m => m.classList.remove('open'));
                toolbar.querySelectorAll('.ft-dropdown-btn').forEach(b => b.classList.remove('open'));
            }
        });

        // Segment dropdown items (exclusive selection)
        toolbar.querySelectorAll('#segment-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                const segmentValue = this.getAttribute('data-v');
                console.log('[DashboardFilterPills] Segment dropdown item clicked:', segmentValue);

                // Close dropdown
                const menu = this.closest('.ft-dropdown-menu');
                const dropdown = menu?.closest('.ft-dropdown');
                if (menu) menu.classList.remove('open');
                if (dropdown) dropdown.querySelector('.ft-dropdown-btn')?.classList.remove('open');

                // Exclusive selection - remove active from siblings
                toolbar.querySelectorAll('#segment-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Update button text
                const btn = document.getElementById('segment-dropdown-btn');
                const labels = {
                    'all': 'Segment',
                    'full': 'Full Game',
                    '1h': '1st Half',
                    '2h': '2nd Half'
                };
                btn.textContent = `${labels[segmentValue] || 'Segment'} ▾`;

                activeFilters.segment = segmentValue === 'all' ? '' : segmentValue;
                applyFilters();
            });
        });

        // Pick type dropdown items (exclusive selection)
        toolbar.querySelectorAll('#pick-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                const pickValue = this.getAttribute('data-v');
                console.log('[DashboardFilterPills] Pick type dropdown item clicked:', pickValue);

                // Close dropdown
                const menu = this.closest('.ft-dropdown-menu');
                const dropdown = menu?.closest('.ft-dropdown');
                if (menu) menu.classList.remove('open');
                if (dropdown) dropdown.querySelector('.ft-dropdown-btn')?.classList.remove('open');

                // Exclusive selection
                toolbar.querySelectorAll('#pick-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Update button text
                const btn = document.getElementById('pick-dropdown-btn');
                const labels = {
                    'all': 'Pick Type',
                    'spread': 'Spread',
                    'ml': 'Moneyline',
                    'total': 'Total',
                    'tt': 'Team Total'
                };
                btn.textContent = `${labels[pickValue] || 'Pick Type'} ▾`;

                activeFilters.pick = pickValue === 'all' ? '' : pickValue;
                applyFilters();
            });
        });

        // Status dropdown items (exclusive selection)
        toolbar.querySelectorAll('#status-dropdown-menu .ft-dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                const statusValue = this.getAttribute('data-v');
                console.log('[DashboardFilterPills] Status dropdown item clicked:', statusValue);

                // Close dropdown
                const menu = this.closest('.ft-dropdown-menu');
                const dropdown = menu?.closest('.ft-dropdown');
                if (menu) menu.classList.remove('open');
                if (dropdown) dropdown.querySelector('.ft-dropdown-btn')?.classList.remove('open');

                // Exclusive selection
                toolbar.querySelectorAll('#status-dropdown-menu .ft-dropdown-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Update button text
                const btn = document.getElementById('status-dropdown-btn');
                const labels = {
                    'all': 'Status',
                    'pending': 'Pending',
                    'win': 'Won',
                    'loss': 'Lost',
                    'push': 'Push'
                };
                btn.textContent = `${labels[statusValue] || 'Status'} ▾`;

                activeFilters.status = statusValue === 'all' ? '' : statusValue;
                applyFilters();
            });
        });

        // Clear button
        const clearBtn = document.getElementById('ft-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('[DashboardFilterPills] Clear filters clicked');
                clearAllFilters();
            });
        }

        console.log('[DashboardFilterPills] Filter pills initialized');
    }

    /**
     * Apply filters to table rows
     */
    function applyFilters() {
        const rows = document.querySelectorAll('#picks-table tbody tr');
        let visibleCount = 0;

        rows.forEach(row => {
            let shouldShow = true;

            // League filter (multi-select)
            if (activeFilters.leagues.length > 0) {
                const rowLeague = (row.getAttribute('data-league') || '').toLowerCase();
                if (!activeFilters.leagues.includes(rowLeague)) {
                    shouldShow = false;
                }
            }

            // Segment filter
            if (activeFilters.segment) {
                const rowSegment = row.getAttribute('data-segment') || '';
                if (rowSegment.toLowerCase() !== activeFilters.segment.toLowerCase()) {
                    shouldShow = false;
                }
            }

            // Pick type filter
            if (activeFilters.pick) {
                const rowPickType = row.getAttribute('data-pick-type') || '';
                if (rowPickType.toLowerCase() !== activeFilters.pick.toLowerCase()) {
                    shouldShow = false;
                }
            }

            // Status filter
            if (activeFilters.status) {
                const rowStatus = row.getAttribute('data-status') || '';
                if (rowStatus.toLowerCase() !== activeFilters.status.toLowerCase()) {
                    shouldShow = false;
                }
            }

            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        console.log(`[DashboardFilterPills] Applied filters - ${visibleCount} rows visible`);

        // Update KPIs if function exists
        if (typeof window.updateKPIValues === 'function') {
            window.updateKPIValues();
        } else if (typeof window.recalculateKPIs === 'function') {
            window.recalculateKPIs();
        }

        // Update table with filters if function exists
        if (typeof window.updateTableWithFilters === 'function') {
            window.updateTableWithFilters();
        }
    }


    /**
     * Clear all filters
     */
    function clearAllFilters() {
        activeFilters = {
            leagues: [],
            segment: '',
            pick: '',
            status: ''
        };

        // Reset league pills
        document.querySelectorAll('.ft-pill.ft-league').forEach(pill => {
            pill.classList.remove('active');
            if (pill.getAttribute('data-league') === 'all') {
                pill.classList.add('active');
            }
        });

        // Reset dropdowns
        const toolbar = document.getElementById('filter-toolbar');
        if (toolbar) {
            // Reset segment dropdown
            toolbar.querySelectorAll('#segment-dropdown-menu .ft-dropdown-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-v') === 'all') {
                    item.classList.add('active');
                }
            });
            document.getElementById('segment-dropdown-btn').textContent = 'Segment ▾';

            // Reset pick dropdown
            toolbar.querySelectorAll('#pick-dropdown-menu .ft-dropdown-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-v') === 'all') {
                    item.classList.add('active');
                }
            });
            document.getElementById('pick-dropdown-btn').textContent = 'Pick Type ▾';

            // Reset status dropdown
            toolbar.querySelectorAll('#status-dropdown-menu .ft-dropdown-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-v') === 'all') {
                    item.classList.add('active');
                }
            });
            document.getElementById('status-dropdown-btn').textContent = 'Status ▾';
        }

        applyFilters();
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFilterPills);
    } else {
        initializeFilterPills();
    }

    // Export for external access
    window.DashboardFilterPills = {
        applyFilters,
        clearAllFilters
    };

})();


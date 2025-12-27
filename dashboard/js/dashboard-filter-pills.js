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
     * Normalize segment value for comparison
     * Row values: 'full-game', '1st-half', '2nd-half'
     * Filter values: 'full', '1h', '2h'
     */
    function normalizeSegmentForFilter(rowSegment) {
        const seg = (rowSegment || '').toLowerCase().trim();
        if (seg === 'full-game' || seg === 'full game' || seg === 'full') return 'full';
        if (seg === '1st-half' || seg === '1st half' || seg === '1h' || seg.includes('1st')) return '1h';
        if (seg === '2nd-half' || seg === '2nd half' || seg === '2h' || seg.includes('2nd')) return '2h';
        return seg;
    }

    /**
     * Normalize pick type for comparison
     * Row values: 'spread', 'total', 'moneyline'
     * Filter values: 'spread', 'ml', 'total', 'tt'
     */
    function normalizePickTypeForFilter(rowPickType) {
        const pt = (rowPickType || '').toLowerCase().trim();
        if (pt === 'moneyline' || pt === 'ml') return 'ml';
        if (pt === 'spread') return 'spread';
        if (pt === 'total' || pt === 'over' || pt === 'under') return 'total';
        if (pt === 'team-total' || pt === 'team total' || pt === 'tt') return 'tt';
        return pt;
    }

    /**
     * Apply filters to table rows
     */
    function applyFilters() {
        const table = document.getElementById('picks-table');
        if (!table) {
            console.warn('[DashboardFilterPills] Table #picks-table not found');
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.warn('[DashboardFilterPills] Table tbody not found');
            return;
        }
        
        const rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) {
            console.log('[DashboardFilterPills] No rows found in table');
            return;
        }
        
        console.log(`[DashboardFilterPills] Applying filters to ${rows.length} rows`);
        console.log('[DashboardFilterPills] Active filters:', activeFilters);
        
        let visibleCount = 0;

        rows.forEach((row, index) => {
            let shouldShow = true;

            // League filter (multi-select)
            if (activeFilters.leagues.length > 0) {
                const rowLeague = (row.getAttribute('data-league') || '').toLowerCase().trim();
                // Handle league variations
                const leagueMatches = activeFilters.leagues.some(filterLeague => {
                    const fl = filterLeague.toLowerCase().trim();
                    // Direct match
                    if (rowLeague === fl) return true;
                    // Handle college football variations
                    if (fl === 'ncaaf' && (rowLeague === 'college' || rowLeague === 'cfb' || rowLeague.includes('college football') || rowLeague.includes('ncaa football'))) return true;
                    // Handle college basketball variations
                    if (fl === 'ncaab' && (rowLeague === 'ncaam' || rowLeague === 'cbb' || rowLeague.includes('college basketball') || rowLeague.includes('ncaa basketball'))) return true;
                    return false;
                });
                if (!leagueMatches) {
                    shouldShow = false;
                    if (index < 3) console.log(`[DashboardFilterPills] Row ${index} hidden by league filter. Row league: "${rowLeague}", Filter leagues:`, activeFilters.leagues);
                }
            }

            // Segment filter
            if (activeFilters.segment) {
                const rowSegment = row.getAttribute('data-segment') || '';
                const normalizedRowSegment = normalizeSegmentForFilter(rowSegment);
                const normalizedFilterSegment = activeFilters.segment.toLowerCase().trim();
                if (normalizedRowSegment !== normalizedFilterSegment) {
                    shouldShow = false;
                    if (index < 3) console.log(`[DashboardFilterPills] Row ${index} hidden by segment filter. Row segment: "${rowSegment}" (normalized: "${normalizedRowSegment}"), Filter: "${normalizedFilterSegment}"`);
                }
            }

            // Pick type filter
            if (activeFilters.pick) {
                const rowPickType = row.getAttribute('data-pick-type') || '';
                const normalizedRowPickType = normalizePickTypeForFilter(rowPickType);
                const normalizedFilterPickType = activeFilters.pick.toLowerCase().trim();
                if (normalizedRowPickType !== normalizedFilterPickType) {
                    shouldShow = false;
                    if (index < 3) console.log(`[DashboardFilterPills] Row ${index} hidden by pick type filter. Row pick type: "${rowPickType}" (normalized: "${normalizedRowPickType}"), Filter: "${normalizedFilterPickType}"`);
                }
            }

            // Status filter
            if (activeFilters.status) {
                const rowStatus = (row.getAttribute('data-status') || '').toLowerCase().trim();
                const filterStatus = activeFilters.status.toLowerCase().trim();
                // Handle status variations
                let statusMatches = false;
                if (rowStatus === filterStatus) {
                    statusMatches = true;
                } else if (filterStatus === 'win' && (rowStatus === 'won' || rowStatus === 'win')) {
                    statusMatches = true;
                } else if (filterStatus === 'loss' && (rowStatus === 'lost' || rowStatus === 'loss')) {
                    statusMatches = true;
                } else if (filterStatus === 'pending' && (rowStatus === 'pending' || rowStatus === 'live' || rowStatus === 'on-track' || rowStatus === 'at-risk')) {
                    statusMatches = true;
                }
                if (!statusMatches) {
                    shouldShow = false;
                    if (index < 3) console.log(`[DashboardFilterPills] Row ${index} hidden by status filter. Row status: "${rowStatus}", Filter: "${filterStatus}"`);
                }
            }

            if (shouldShow) {
                row.style.display = '';
                row.classList.remove('filter-hidden');
                visibleCount++;
            } else {
                row.style.display = 'none';
                row.classList.add('filter-hidden');
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

